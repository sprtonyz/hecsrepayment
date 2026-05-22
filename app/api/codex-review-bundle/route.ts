import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCodexReviewBrief } from "@/lib/news/codexReviewBundle";
import { fetchReadableArticleText } from "@/lib/news/articleText";

const MAX_MONTHLY_ARTICLES = 40;
const MAX_BUNDLE_TEXT_CHARS = 8_000;

const symbolSchema = z.string().min(1).max(12).regex(/^[a-z0-9.-]+$/i);
const reviewMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const newsArticleSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  url: z.string().url(),
  source: z.string().min(1),
  provider: z.string().min(1).max(64),
  publishedAt: z.string().optional(),
  collectedAt: z.string().optional(),
  cachedAt: z.string().optional(),
  lastFetchedAt: z.string().optional(),
  signal: z.enum(["positive", "neutral", "negative"]),
  signalScore: z.number(),
  matchedTerms: z.array(z.string()),
});

const newsAnalysisSchema = z.object({
  articleId: z.string(),
  analyzedAt: z.string(),
  analysisMode: z.enum(["testing", "performance"]),
  finalModel: z.string(),
  escalatedModel: z.string().optional(),
  signal: z.enum(["positive", "neutral", "negative"]),
  confidence: z.enum(["low", "medium", "high"]),
  materiality: z.enum(["low", "medium", "high"]),
  thesisImpactScore: z.number(),
  category: z.string(),
  timeHorizon: z.string(),
  rationale: z.string(),
  evidence: z.array(z.string()),
  riskFlags: z.array(z.string()),
  opportunities: z.array(z.string()),
});

const bodySchema = z.object({
  symbol: symbolSchema,
  reviewMonth: reviewMonthSchema,
  articles: z.array(newsArticleSchema),
  analyses: z.array(newsAnalysisSchema).default([]),
  guideContext: z.record(z.string(), z.unknown()).optional(),
});

const appliedNewsDigestSchema = z.object({
  signal: z.enum(["positive", "neutral", "negative"]),
  confidence: z.enum(["low", "medium", "high"]),
  articleCount: z.number(),
  providerCount: z.number(),
  providers: z.array(z.string()),
  failedProviders: z.array(z.string()).optional(),
  publisherCount: z.number().optional(),
  publishers: z.array(z.string()).optional(),
  score: z.number().optional(),
  headlines: z.array(z.string()).optional(),
  positiveArticleCount: z.number().optional(),
  negativeArticleCount: z.number().optional(),
  neutralArticleCount: z.number().optional(),
  materialArticleCount: z.number().optional(),
  highMaterialityCount: z.number().optional(),
  escalatedCount: z.number().optional(),
  analysisMode: z.literal("codexReview"),
});

const codexReviewSchema = z.object({
  appliedNewsDigest: appliedNewsDigestSchema,
}).passthrough();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = z.object({
    symbol: symbolSchema,
    reviewMonth: reviewMonthSchema,
  }).safeParse({
    symbol: searchParams.get("symbol"),
    reviewMonth: searchParams.get("reviewMonth"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Codex review lookup." }, { status: 400 });
  }

  const { absolutePath, filename } = reviewBundlePath(
    parsed.data.symbol,
    parsed.data.reviewMonth,
  );
  const bundle = await readReviewBundle(absolutePath);
  if (!bundle) {
    return noStoreJson({
      filename,
      codexReview: null,
    });
  }

  const codexReview = codexReviewSchema.safeParse(bundle.codexReview);
  return noStoreJson({
    filename,
    generatedAt: typeof bundle.generatedAt === "string" ? bundle.generatedAt : undefined,
    includedArticleCount:
      typeof bundle.includedArticleCount === "number" ? bundle.includedArticleCount : undefined,
    codexReview: codexReview.success ? codexReview.data : null,
  });
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Codex review bundle request." }, { status: 400 });
  }

  const { symbol, reviewMonth, guideContext } = parsed.data;
  const analysesByArticleId = new Map(
    parsed.data.analyses.map((analysis) => [analysis.articleId, analysis]),
  );
  const selectedArticles = parsed.data.articles
    .filter((article) => article.symbol.toUpperCase() === symbol.toUpperCase())
    .filter((article) => monthKey(article.collectedAt || article.cachedAt || article.publishedAt) === reviewMonth)
    .sort((left, right) => compareBundleArticles(left, right, analysesByArticleId))
    .slice(0, MAX_MONTHLY_ARTICLES);

  const articlesWithText = [];
  for (const article of selectedArticles) {
    const articleText = await fetchReadableArticleText(
      article.url,
      `${article.title}\n\n${article.summary ?? ""}`,
    );
    const existingAnalysis = analysesByArticleId.get(article.id);
    articlesWithText.push({
      id: article.id,
      symbol: article.symbol,
      title: article.title,
      source: article.source,
      provider: article.provider,
      url: article.url,
      publishedAt: article.publishedAt,
      collectedAt: article.collectedAt || article.cachedAt,
      lastFetchedAt: article.lastFetchedAt || article.cachedAt,
      ageBucket: ageBucket(article.publishedAt || article.collectedAt || article.cachedAt),
      headlineRuleSignal: article.signal,
      headlineRuleScore: article.signalScore,
      matchedTerms: article.matchedTerms,
      summary: article.summary,
      articleTextStatus: articleText.status,
      readableTextExcerpt: articleText.text.slice(0, MAX_BUNDLE_TEXT_CHARS),
      existingApiAnalysis: existingAnalysis
        ? {
            analyzedAt: existingAnalysis.analyzedAt,
            mode: existingAnalysis.analysisMode,
            model: existingAnalysis.finalModel,
            escalatedModel: existingAnalysis.escalatedModel,
            signal: existingAnalysis.signal,
            confidence: existingAnalysis.confidence,
            materiality: existingAnalysis.materiality,
            thesisImpactScore: existingAnalysis.thesisImpactScore,
            category: existingAnalysis.category,
            timeHorizon: existingAnalysis.timeHorizon,
            rationale: existingAnalysis.rationale,
            evidence: existingAnalysis.evidence,
            riskFlags: existingAnalysis.riskFlags,
            opportunities: existingAnalysis.opportunities,
          }
        : undefined,
    });
  }

  const generatedAt = new Date().toISOString();
  const { absolutePath, filename } = reviewBundlePath(symbol, reviewMonth);
  const existingCodexReview = await readExistingCodexReview(absolutePath);
  const reviewBrief = buildCodexReviewBrief({
    symbol,
    reviewMonth,
    requestedArticleCount: parsed.data.articles.length,
    includedArticleCount: articlesWithText.length,
    guideContext,
    articles: articlesWithText,
  });
  const bundle = {
    kind: "codex-monthly-news-review",
    symbol: symbol.toUpperCase(),
    reviewMonth,
    generatedAt,
    articleLimit: MAX_MONTHLY_ARTICLES,
    requestedArticleCount: parsed.data.articles.length,
    includedArticleCount: articlesWithText.length,
    guideContext,
    reviewBrief,
    instructions: [
      "Review this local bundle for the monthly AAPL deposit guide.",
      "Prioritize durable thesis impact, unresolved legal/regulatory risk, earnings/product/service trends, and material competitive changes.",
      "Downweight stale market chatter, repeated analyst/price-action articles, tokenization mechanics with no Apple-specific impact, and articles with only summary text.",
      "Return a concise JSON review that the app can later load: signal, confidence, material items, stale/noisy items, unresolved themes, suggested guide impact, and rationale.",
    ],
    codexReview: existingCodexReview,
    articles: articlesWithText,
  };

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  return NextResponse.json({
    path: absolutePath,
    filename,
    includedArticleCount: articlesWithText.length,
    reviewBrief: {
      duplicateGroupCount: reviewBrief.coverage.duplicateGroupCount,
      likelyNoiseArticleCount: reviewBrief.coverage.likelyNoiseArticleCount,
      articleTextStatusCounts: reviewBrief.coverage.articleTextStatusCounts,
    },
    generatedAt,
  });
}

function reviewBundlePath(symbol: string, reviewMonth: string) {
  const directory = path.join(process.cwd(), "data", "news-review-queue");
  const filename = `${reviewMonth}-${symbol.toLowerCase()}-codex-review.json`;
  return {
    directory,
    filename,
    absolutePath: path.join(directory, filename),
  };
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "cache-control": "no-store",
    },
  });
}

async function readExistingCodexReview(absolutePath: string) {
  const bundle = await readReviewBundle(absolutePath);
  if (!bundle) {
    return undefined;
  }
  const codexReview = codexReviewSchema.safeParse(bundle.codexReview);
  return codexReview.success ? codexReview.data : undefined;
}

async function readReviewBundle(absolutePath: string) {
  try {
    return JSON.parse(await readFile(absolutePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function compareBundleArticles(
  left: z.infer<typeof newsArticleSchema>,
  right: z.infer<typeof newsArticleSchema>,
  analysesByArticleId: Map<string, z.infer<typeof newsAnalysisSchema>>,
) {
  const leftAnalysis = analysesByArticleId.get(left.id);
  const rightAnalysis = analysesByArticleId.get(right.id);
  const scoreDiff =
    articlePriority(right, rightAnalysis) - articlePriority(left, leftAnalysis);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  return (right.collectedAt || right.cachedAt || right.publishedAt || "").localeCompare(
    left.collectedAt || left.cachedAt || left.publishedAt || "",
  );
}

function articlePriority(
  article: z.infer<typeof newsArticleSchema>,
  analysis?: z.infer<typeof newsAnalysisSchema>,
) {
  const materiality =
    analysis?.materiality === "high" ? 8 : analysis?.materiality === "medium" ? 4 : 0;
  const signal = Math.abs(analysis?.thesisImpactScore ?? article.signalScore);
  const recency =
    ageBucket(article.publishedAt || article.collectedAt || article.cachedAt) === "0-3d"
      ? 3
      : 0;
  return materiality + signal + recency;
}

function monthKey(value: string | undefined) {
  return value?.slice(0, 7);
}

function ageBucket(value: string | undefined) {
  if (!value) {
    return "unknown";
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  if (ageDays <= 3) {
    return "0-3d";
  }
  if (ageDays <= 7) {
    return "4-7d";
  }
  if (ageDays <= 30) {
    return "8-30d";
  }
  return "30d+";
}
