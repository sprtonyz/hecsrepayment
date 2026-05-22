import type { ArticleTextResult } from "@/lib/news/articleText";
import type { NewsArticle, NewsSignal } from "@/lib/news/types";
import type { AiNewsAnalysisMode, CachedNewsAnalysis } from "@/lib/storage/types";

type ArticleAnalysisModelResult = {
  signal: NewsSignal;
  confidence: "low" | "medium" | "high";
  materiality: "low" | "medium" | "high";
  thesisImpactScore: number;
  category:
    | "earnings"
    | "product"
    | "legalRegulatory"
    | "supplyChain"
    | "macroRatesFx"
    | "analystRating"
    | "competitivePosition"
    | "capitalReturn"
    | "valuationMarketAction"
    | "other";
  timeHorizon: "shortTerm" | "mediumTerm" | "longTerm" | "unknown";
  rationale: string;
  evidence: string[];
  riskFlags: string[];
  opportunities: string[];
  shouldEscalate: boolean;
  escalationReason: string;
};

export type AnalyzeArticleInput = {
  article: NewsArticle;
  articleText: ArticleTextResult;
  apiKey: string;
  now?: string;
};

const MINI_MODEL = "gpt-5.4-mini";
const ESCALATION_MODEL = "gpt-5.4";
const TESTING_MODEL = "gpt-5-nano";

export function getAiNewsAnalysisMode(): AiNewsAnalysisMode {
  return process.env.OPENAI_NEWS_ANALYSIS_MODE?.toLowerCase() === "performance"
    ? "performance"
    : "testing";
}

export function modelsForAiNewsAnalysisMode(mode: AiNewsAnalysisMode) {
  if (mode === "performance") {
    return {
      primaryModel: MINI_MODEL,
      escalationModel: ESCALATION_MODEL,
      allowEscalation: true,
    };
  }

  return {
    primaryModel: TESTING_MODEL,
    escalationModel: undefined,
    allowEscalation: false,
  };
}

export async function analyzeArticleWithEscalation({
  article,
  articleText,
  apiKey,
  now = new Date().toISOString(),
}: AnalyzeArticleInput): Promise<CachedNewsAnalysis> {
  const mode = getAiNewsAnalysisMode();
  const models = modelsForAiNewsAnalysisMode(mode);
  const fallbackAnalysis = buildUnavailableAnalysis(article, articleText, now);
  if (articleText.status === "unavailable" || !articleText.text) {
    return {
      ...fallbackAnalysis,
      analysisMode: mode,
    };
  }

  const mini = await analyzeWithModel({
    model: models.primaryModel,
    apiKey,
    article,
    articleText,
  });
  const shouldEscalate =
    models.allowEscalation &&
    (mini.shouldEscalate ||
      mini.materiality === "high" ||
      mini.confidence === "low" ||
      (Math.abs(mini.thesisImpactScore) >= 2 && mini.confidence !== "high"));

  if (!shouldEscalate || !models.escalationModel) {
    return toCachedAnalysis(article, articleText, mini, now, mode, models.primaryModel);
  }

  const escalated = await analyzeWithModel({
    model: models.escalationModel,
    apiKey,
    article,
    articleText,
    priorAnalysis: mini,
  });

  return toCachedAnalysis(
    article,
    articleText,
    escalated,
    now,
    mode,
    models.escalationModel,
    models.primaryModel,
  );
}

export function buildAiNewsDigest(
  symbol: string,
  analyses: CachedNewsAnalysis[],
  asOf = new Date().toISOString(),
) {
  const recent = dedupeAnalysesByArticle(analyses)
    .filter((analysis) => analysis.symbol === symbol && isRecent(analysis.analyzedAt, asOf))
    .sort((left, right) => right.analyzedAt.localeCompare(left.analyzedAt));
  const material = recent.filter((analysis) => analysis.materiality !== "low");
  const weightedScore = recent.reduce((total, analysis) => {
    const materialityWeight = analysis.materiality === "high" ? 1.5 : analysis.materiality === "medium" ? 1 : 0.35;
    const confidenceWeight = analysis.confidence === "high" ? 1 : analysis.confidence === "medium" ? 0.75 : 0.45;
    const horizonWeight = analysis.timeHorizon === "longTerm" ? 1.2 : analysis.timeHorizon === "mediumTerm" ? 1 : 0.7;
    return total + analysis.thesisImpactScore * materialityWeight * confidenceWeight * horizonWeight;
  }, 0);
  const normalizedScore = recent.length > 0 ? weightedScore / Math.sqrt(recent.length) : 0;
  const signal: NewsSignal =
    normalizedScore >= 1.25 ? "positive" : normalizedScore <= -1.25 ? "negative" : "neutral";
  const providerCount = new Set(recent.map((analysis) => analysis.source)).size;
  const publishers = Array.from(new Set(recent.map((analysis) => analysis.source))).sort();
  const highMaterialityCount = recent.filter((analysis) => analysis.materiality === "high").length;
  const escalatedCount = recent.filter((analysis) => analysis.escalatedModel).length;
  const confidence: "low" | "medium" | "high" =
    recent.length >= 8 && providerCount >= 2
      ? "high"
      : recent.length >= 3 || providerCount >= 2
        ? "medium"
        : "low";

  return {
    signal,
    confidence,
    articleCount: recent.length,
    providerCount,
    providers: publishers,
    publisherCount: publishers.length,
    publishers,
    score: Math.round(normalizedScore * 100) / 100,
    headlines: recent.slice(0, 6).map((analysis) => `${analysis.source}: ${analysis.title}`),
    positiveArticleCount: recent.filter((analysis) => analysis.signal === "positive").length,
    negativeArticleCount: recent.filter((analysis) => analysis.signal === "negative").length,
    neutralArticleCount: recent.filter((analysis) => analysis.signal === "neutral").length,
    materialArticleCount: material.length,
    highMaterialityCount,
    escalatedCount,
  };
}

async function analyzeWithModel({
  model,
  apiKey,
  article,
  articleText,
  priorAnalysis,
}: {
  model: string;
  apiKey: string;
  article: NewsArticle;
  articleText: ArticleTextResult;
  priorAnalysis?: ArticleAnalysisModelResult;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: model === ESCALATION_MODEL ? "medium" : "low" },
      input: [
        {
          role: "developer",
          content:
            "You are an investment-news materiality analyst for a personal finance tracker. Analyze only the provided article text. Do not browse. Be conservative, separate durable business impact from market noise, and do not provide personalized financial advice.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: priorAnalysis
              ? "Re-check this article because the first pass marked it high impact or uncertain."
              : "Analyze this article for investment relevance to the tracked stock.",
            symbol: article.symbol,
            title: article.title,
            source: article.source,
            url: article.url,
            publishedAt: article.publishedAt,
            firstPass: priorAnalysis,
            articleTextStatus: articleText.status,
            articleText: articleText.text,
          }),
        },
      ],
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "investment_article_analysis",
          strict: true,
          schema: articleAnalysisSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI article analysis failed: ${response.status} ${message.slice(0, 240)}`);
  }

  const data = await response.json();
  return sanitizeAnalysis(JSON.parse(extractOutputText(data)));
}

function toCachedAnalysis(
  article: NewsArticle,
  articleText: ArticleTextResult,
  analysis: ArticleAnalysisModelResult,
  analyzedAt: string,
  analysisMode: AiNewsAnalysisMode,
  finalModel: string,
  primaryModel = finalModel,
): CachedNewsAnalysis {
  return {
    id: `${article.id}-${analysisMode}-${finalModel}`,
    articleId: article.id,
    symbol: article.symbol,
    url: article.url,
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
    analyzedAt,
    analysisMode,
    primaryModel,
    finalModel,
    escalatedModel: finalModel === primaryModel ? undefined : finalModel,
    articleTextStatus: articleText.status,
    signal: analysis.signal,
    confidence: analysis.confidence,
    materiality: analysis.materiality,
    thesisImpactScore: clamp(analysis.thesisImpactScore, -3, 3),
    category: analysis.category,
    timeHorizon: analysis.timeHorizon,
    rationale: analysis.rationale,
    evidence: analysis.evidence.slice(0, 4),
    riskFlags: analysis.riskFlags.slice(0, 5),
    opportunities: analysis.opportunities.slice(0, 5),
    shouldEscalate: analysis.shouldEscalate,
    escalationReason: analysis.escalationReason,
  };
}

function buildUnavailableAnalysis(
  article: NewsArticle,
  articleText: ArticleTextResult,
  analyzedAt: string,
): CachedNewsAnalysis {
  return {
    id: `${article.id}-unavailable`,
    articleId: article.id,
    symbol: article.symbol,
    url: article.url,
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
    analyzedAt,
    analysisMode: getAiNewsAnalysisMode(),
    primaryModel: "none",
    finalModel: "none",
    articleTextStatus: articleText.status,
    signal: "neutral",
    confidence: "low",
    materiality: "low",
    thesisImpactScore: 0,
    category: "other",
    timeHorizon: "unknown",
    rationale: "Article text was unavailable, so the app did not use AI to infer investment materiality.",
    evidence: [],
    riskFlags: [],
    opportunities: [],
    shouldEscalate: false,
    escalationReason: "",
  };
}

function extractOutputText(response: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (response.output_text) {
    return response.output_text;
  }
  const text = response.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }
  return text;
}

function sanitizeAnalysis(value: ArticleAnalysisModelResult): ArticleAnalysisModelResult {
  return {
    signal: value.signal,
    confidence: value.confidence,
    materiality: value.materiality,
    thesisImpactScore: clamp(value.thesisImpactScore, -3, 3),
    category: value.category,
    timeHorizon: value.timeHorizon,
    rationale: value.rationale.slice(0, 500),
    evidence: value.evidence.slice(0, 4).map((item) => item.slice(0, 240)),
    riskFlags: value.riskFlags.slice(0, 5).map((item) => item.slice(0, 120)),
    opportunities: value.opportunities.slice(0, 5).map((item) => item.slice(0, 120)),
    shouldEscalate: value.shouldEscalate,
    escalationReason: value.escalationReason.slice(0, 240),
  };
}

function isRecent(value: string, asOf: string) {
  const ageMs = Date.parse(asOf) - Date.parse(value);
  return Number.isFinite(ageMs) && ageMs <= 30 * 86_400_000;
}

function dedupeAnalysesByArticle(analyses: CachedNewsAnalysis[]) {
  const ranked = [...analyses].sort((left, right) => {
    const leftRank = analysisRank(left);
    const rightRank = analysisRank(right);
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }
    return right.analyzedAt.localeCompare(left.analyzedAt);
  });
  const seen = new Set<string>();
  return ranked.filter((analysis) => {
    if (seen.has(analysis.articleId)) {
      return false;
    }
    seen.add(analysis.articleId);
    return true;
  });
}

function analysisRank(analysis: CachedNewsAnalysis) {
  if (analysis.analysisMode === "performance") {
    return 3;
  }
  if (analysis.finalModel === ESCALATION_MODEL) {
    return 2;
  }
  if (analysis.analysisMode === "testing") {
    return 1;
  }
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

const articleAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    signal: { type: "string", enum: ["positive", "neutral", "negative"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    materiality: { type: "string", enum: ["low", "medium", "high"] },
    thesisImpactScore: { type: "number" },
    category: {
      type: "string",
      enum: [
        "earnings",
        "product",
        "legalRegulatory",
        "supplyChain",
        "macroRatesFx",
        "analystRating",
        "competitivePosition",
        "capitalReturn",
        "valuationMarketAction",
        "other",
      ],
    },
    timeHorizon: { type: "string", enum: ["shortTerm", "mediumTerm", "longTerm", "unknown"] },
    rationale: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    opportunities: { type: "array", items: { type: "string" } },
    shouldEscalate: { type: "boolean" },
    escalationReason: { type: "string" },
  },
  required: [
    "signal",
    "confidence",
    "materiality",
    "thesisImpactScore",
    "category",
    "timeHorizon",
    "rationale",
    "evidence",
    "riskFlags",
    "opportunities",
    "shouldEscalate",
    "escalationReason",
  ],
};
