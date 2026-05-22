import { createClient } from "@supabase/supabase-js";
import type { CachedNewsAnalysis, CachedNewsArticle } from "@/lib/storage/types";
import { getSharedNewsConfig, isSharedNewsSyncEnabled } from "@/lib/shared-news/config";

const SHARED_ARTICLES_TABLE = "shared_news_articles";
const SHARED_ANALYSES_TABLE = "shared_news_analyses";

type SharedNewsArticleRow = {
  id: string;
  review_month: string;
  symbol: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  provider: string;
  published_at: string | null;
  collected_at: string | null;
  cached_at: string | null;
  last_fetched_at: string | null;
  signal: CachedNewsArticle["signal"];
  signal_score: number;
  matched_terms: string[];
  raw: unknown;
  updated_at?: string;
};

type SharedNewsAnalysisRow = {
  id: string;
  article_id: string;
  review_month: string;
  symbol: string;
  url: string;
  title: string;
  source: string;
  published_at: string | null;
  analyzed_at: string;
  analysis_mode: CachedNewsAnalysis["analysisMode"];
  primary_model: string;
  final_model: string;
  escalated_model: string | null;
  article_text_status: CachedNewsAnalysis["articleTextStatus"];
  signal: CachedNewsAnalysis["signal"];
  confidence: CachedNewsAnalysis["confidence"];
  materiality: CachedNewsAnalysis["materiality"];
  thesis_impact_score: number;
  category: CachedNewsAnalysis["category"];
  time_horizon: CachedNewsAnalysis["timeHorizon"];
  rationale: string;
  evidence: string[];
  risk_flags: string[];
  opportunities: string[];
  should_escalate: boolean;
  escalation_reason: string;
  raw: unknown;
  updated_at?: string;
};

export type SharedNewsSnapshot = {
  enabled: boolean;
  reviewMonth?: string;
  sourceUpdatedAt?: string;
  articles: CachedNewsArticle[];
  analyses: CachedNewsAnalysis[];
};

export type SharedSyncResult = {
  enabled: boolean;
  synced: boolean;
  message?: string;
  reviewMonth?: string;
  articleCount?: number;
  analysisCount?: number;
  sourceUpdatedAt?: string;
};

export async function upsertSharedNewsArticles(
  articles: CachedNewsArticle[],
  syncedAt = new Date().toISOString(),
): Promise<SharedSyncResult> {
  if (!isSharedNewsSyncEnabled()) {
    return { enabled: false, synced: false };
  }

  if (articles.length === 0) {
    return {
      enabled: true,
      synced: true,
      articleCount: 0,
      sourceUpdatedAt: syncedAt,
    };
  }

  const supabase = createSharedNewsClient();
  const existingCollectedAt = new Map<string, string | undefined>();
  const articleIds = articles.map((article) => article.id);
  const { data: existingRows, error: existingError } = await supabase
    .from(SHARED_ARTICLES_TABLE)
    .select("id,collected_at")
    .in("id", articleIds);

  if (existingError) {
    throw new Error(`Shared article sync lookup failed: ${existingError.message}`);
  }

  for (const row of (existingRows ?? []) as Array<{ id: string; collected_at?: string | null }>) {
    existingCollectedAt.set(row.id, row.collected_at || undefined);
  }

  const rows = articles.map((article) =>
    toSharedArticleRow(article, syncedAt, existingCollectedAt.get(article.id)),
  );
  const { error } = await supabase
    .from(SHARED_ARTICLES_TABLE)
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`Shared article sync failed: ${error.message}`);
  }

  return {
    enabled: true,
    synced: true,
    reviewMonth: latestReviewMonth(rows.map((row) => row.review_month)),
    articleCount: rows.length,
    sourceUpdatedAt: syncedAt,
  };
}

export async function upsertSharedNewsAnalyses(
  analyses: CachedNewsAnalysis[],
): Promise<SharedSyncResult> {
  if (!isSharedNewsSyncEnabled()) {
    return { enabled: false, synced: false };
  }

  if (analyses.length === 0) {
    return {
      enabled: true,
      synced: true,
      analysisCount: 0,
    };
  }

  const supabase = createSharedNewsClient();
  const rows = analyses.map(toSharedAnalysisRow);
  const { error } = await supabase
    .from(SHARED_ANALYSES_TABLE)
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`Shared analysis sync failed: ${error.message}`);
  }

  return {
    enabled: true,
    synced: true,
    reviewMonth: latestReviewMonth(rows.map((row) => row.review_month)),
    analysisCount: rows.length,
    sourceUpdatedAt: latestIso(rows.map((row) => row.analyzed_at)),
  };
}

export async function getLatestSharedNewsSnapshot(
  symbol: string,
  explicitReviewMonth?: string,
): Promise<SharedNewsSnapshot> {
  if (!isSharedNewsSyncEnabled()) {
    return {
      enabled: false,
      articles: [],
      analyses: [],
    };
  }

  const normalizedSymbol = symbol.toUpperCase();
  const supabase = createSharedNewsClient();
  const reviewMonth = explicitReviewMonth || (await getLatestReviewMonth(normalizedSymbol));

  if (!reviewMonth) {
    return {
      enabled: true,
      articles: [],
      analyses: [],
    };
  }

  const { data: articleRows, error: articleError } = await supabase
    .from(SHARED_ARTICLES_TABLE)
    .select("*")
    .eq("symbol", normalizedSymbol)
    .eq("review_month", reviewMonth)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("last_fetched_at", { ascending: false, nullsFirst: false });

  if (articleError) {
    throw new Error(`Shared article read failed: ${articleError.message}`);
  }

  const articles = ((articleRows ?? []) as SharedNewsArticleRow[]).map(fromSharedArticleRow);
  if (articles.length === 0) {
    return {
      enabled: true,
      reviewMonth,
      articles: [],
      analyses: [],
    };
  }

  const articleIds = articles.map((article) => article.id);
  const { data: analysisRows, error: analysisError } = await supabase
    .from(SHARED_ANALYSES_TABLE)
    .select("*")
    .eq("symbol", normalizedSymbol)
    .eq("review_month", reviewMonth)
    .in("article_id", articleIds)
    .order("analyzed_at", { ascending: false, nullsFirst: false });

  if (analysisError) {
    throw new Error(`Shared analysis read failed: ${analysisError.message}`);
  }

  const analyses = ((analysisRows ?? []) as SharedNewsAnalysisRow[]).map(fromSharedAnalysisRow);

  return {
    enabled: true,
    reviewMonth,
    sourceUpdatedAt: latestIso([
      ...articles.map((article) => article.lastFetchedAt || article.cachedAt || article.collectedAt),
      ...analyses.map((analysis) => analysis.analyzedAt),
    ]),
    articles,
    analyses,
  };
}

function createSharedNewsClient() {
  const { url, secretKey } = getSharedNewsConfig();
  if (!url || !secretKey) {
    throw new Error("Shared news sync is not configured.");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function getLatestReviewMonth(symbol: string) {
  const supabase = createSharedNewsClient();
  const { data, error } = await supabase
    .from(SHARED_ARTICLES_TABLE)
    .select("review_month,last_fetched_at")
    .eq("symbol", symbol)
    .order("review_month", { ascending: false })
    .order("last_fetched_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Shared review month lookup failed: ${error.message}`);
  }

  return data?.review_month || undefined;
}

function toSharedArticleRow(
  article: CachedNewsArticle,
  syncedAt: string,
  existingCollectedAt?: string,
): SharedNewsArticleRow {
  const collectedAt = existingCollectedAt || article.collectedAt || article.cachedAt || syncedAt;
  const cachedAt = article.cachedAt || syncedAt;
  const lastFetchedAt = article.lastFetchedAt || syncedAt;
  return {
    id: article.id,
    review_month: reviewMonthForValue(article.publishedAt || collectedAt || cachedAt),
    symbol: article.symbol.toUpperCase(),
    title: article.title,
    summary: article.summary ?? null,
    url: article.url,
    source: article.source,
    provider: article.provider,
    published_at: article.publishedAt ?? null,
    collected_at: collectedAt,
    cached_at: cachedAt,
    last_fetched_at: lastFetchedAt,
    signal: article.signal,
    signal_score: article.signalScore,
    matched_terms: article.matchedTerms,
    raw: article.raw,
    updated_at: syncedAt,
  };
}

function fromSharedArticleRow(row: SharedNewsArticleRow): CachedNewsArticle {
  return {
    id: row.id,
    symbol: row.symbol,
    title: row.title,
    summary: row.summary ?? undefined,
    url: row.url,
    source: row.source,
    provider: row.provider,
    publishedAt: row.published_at ?? undefined,
    collectedAt: row.collected_at ?? undefined,
    cachedAt: row.cached_at ?? undefined,
    lastFetchedAt: row.last_fetched_at ?? undefined,
    signal: row.signal,
    signalScore: row.signal_score,
    matchedTerms: row.matched_terms ?? [],
    raw: row.raw,
  };
}

function toSharedAnalysisRow(analysis: CachedNewsAnalysis): SharedNewsAnalysisRow {
  return {
    id: analysis.id,
    article_id: analysis.articleId,
    review_month: reviewMonthForValue(analysis.publishedAt || analysis.analyzedAt),
    symbol: analysis.symbol.toUpperCase(),
    url: analysis.url,
    title: analysis.title,
    source: analysis.source,
    published_at: analysis.publishedAt ?? null,
    analyzed_at: analysis.analyzedAt,
    analysis_mode: analysis.analysisMode,
    primary_model: analysis.primaryModel,
    final_model: analysis.finalModel,
    escalated_model: analysis.escalatedModel ?? null,
    article_text_status: analysis.articleTextStatus,
    signal: analysis.signal,
    confidence: analysis.confidence,
    materiality: analysis.materiality,
    thesis_impact_score: analysis.thesisImpactScore,
    category: analysis.category,
    time_horizon: analysis.timeHorizon,
    rationale: analysis.rationale,
    evidence: analysis.evidence,
    risk_flags: analysis.riskFlags,
    opportunities: analysis.opportunities,
    should_escalate: analysis.shouldEscalate,
    escalation_reason: analysis.escalationReason,
    raw: analysis.raw,
    updated_at: analysis.analyzedAt,
  };
}

function fromSharedAnalysisRow(row: SharedNewsAnalysisRow): CachedNewsAnalysis {
  return {
    id: row.id,
    articleId: row.article_id,
    symbol: row.symbol,
    url: row.url,
    title: row.title,
    source: row.source,
    publishedAt: row.published_at ?? undefined,
    analyzedAt: row.analyzed_at,
    analysisMode: row.analysis_mode,
    primaryModel: row.primary_model,
    finalModel: row.final_model,
    escalatedModel: row.escalated_model ?? undefined,
    articleTextStatus: row.article_text_status,
    signal: row.signal,
    confidence: row.confidence,
    materiality: row.materiality,
    thesisImpactScore: row.thesis_impact_score,
    category: row.category,
    timeHorizon: row.time_horizon,
    rationale: row.rationale,
    evidence: row.evidence ?? [],
    riskFlags: row.risk_flags ?? [],
    opportunities: row.opportunities ?? [],
    shouldEscalate: row.should_escalate,
    escalationReason: row.escalation_reason,
    raw: row.raw,
  };
}

function reviewMonthForValue(value: string | undefined) {
  const month = value?.slice(0, 7);
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Date().toISOString().slice(0, 7);
  }
  return month;
}

function latestReviewMonth(values: string[]) {
  return [...values].sort((left, right) => right.localeCompare(left))[0];
}

function latestIso(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];
}
