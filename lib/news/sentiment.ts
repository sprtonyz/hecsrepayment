import type { NewsArticle, NewsDigest, NewsProviderName, NewsSignal } from "@/lib/news/types";

type TermRule = {
  label: string;
  pattern: RegExp;
  weight: number;
};

const POSITIVE_RULES: TermRule[] = [
  { label: "beats estimates", pattern: /\bbeat(s|ing)?\b|\bbeats? estimates?\b/i, weight: 1.4 },
  { label: "raises outlook", pattern: /\braises? (guidance|outlook|forecast|target)\b/i, weight: 1.2 },
  { label: "upgrade", pattern: /\bupgrad(e|ed|es)\b|\boutperform\b|\bbuy rating\b/i, weight: 1.2 },
  { label: "record results", pattern: /\brecord (revenue|profit|sales|quarter)\b/i, weight: 1.1 },
  { label: "growth", pattern: /\b(strong|accelerating|rising) (demand|growth|sales|revenue)\b/i, weight: 0.9 },
  { label: "buyback", pattern: /\bbuyback\b|\bshare repurchase\b/i, weight: 0.9 },
  { label: "expansion", pattern: /\bexpand(s|ed|ing)?\b|\blaunch(es|ed|ing)?\b/i, weight: 0.5 },
  { label: "partnership", pattern: /\bpartnership\b|\bdeal\b|\bagreement\b/i, weight: 0.5 },
];

const NEGATIVE_RULES: TermRule[] = [
  { label: "misses estimates", pattern: /\bmiss(es|ed)?\b|\bmisses? estimates?\b/i, weight: -1.4 },
  { label: "cuts outlook", pattern: /\bcuts? (guidance|outlook|forecast|target)\b/i, weight: -1.3 },
  { label: "downgrade", pattern: /\bdowngrad(e|ed|es)\b|\bunderperform\b|\bsell rating\b/i, weight: -1.2 },
  { label: "weak demand", pattern: /\bweak (demand|sales|revenue)\b|\bslowing demand\b/i, weight: -1.1 },
  { label: "legal pressure", pattern: /\blawsuit\b|\bantitrust\b|\binvestigation\b|\bprobe\b|\bfine\b/i, weight: -0.9 },
  { label: "tariff pressure", pattern: /\btariff(s)?\b|\bexport ban\b|\bsanction(s)?\b/i, weight: -0.8 },
  { label: "supply issues", pattern: /\bdelay(s|ed)?\b|\bsupply (issue|constraint|shortage)s?\b/i, weight: -0.8 },
  { label: "job cuts", pattern: /\blayoff(s)?\b|\bjob cuts?\b/i, weight: -0.7 },
  { label: "bearish move", pattern: /\bplunge(s|d)?\b|\bslump(s|ed)?\b|\bdrop(s|ped)?\b|\bfall(s|en|ing)?\b/i, weight: -0.5 },
];

const NEWS_LOOKBACK_DAYS = 30;
const MAX_DIGEST_ARTICLES = 40;

export function scoreNewsText(title: string, summary = "") {
  const text = `${title} ${summary}`.replace(/\s+/g, " ").trim();
  let score = 0;
  const matchedTerms: string[] = [];

  for (const rule of [...POSITIVE_RULES, ...NEGATIVE_RULES]) {
    if (rule.pattern.test(text)) {
      score += rule.weight;
      matchedTerms.push(rule.label);
    }
  }

  const roundedScore = roundScore(score);
  return {
    signalScore: roundedScore,
    signal: signalFromScore(roundedScore),
    matchedTerms: Array.from(new Set(matchedTerms)),
  };
}

export function buildNewsDigest(
  symbol: string,
  articles: NewsArticle[],
  asOf = new Date().toISOString(),
  failedProviders: NewsProviderName[] = [],
): NewsDigest {
  const dedupedArticles = dedupeArticles(articles)
    .filter((article) => isRecentArticle(article, asOf))
    .sort(compareArticlesByFreshness)
    .slice(0, MAX_DIGEST_ARTICLES);
  const providers = Array.from(new Set(dedupedArticles.map((article) => article.provider))).sort();
  const publishers = Array.from(new Set(dedupedArticles.map((article) => article.source))).sort();
  const weighted = dedupedArticles.reduce(
    (total, article) => {
      const weight = recencyWeight(article.publishedAt, asOf);
      return {
        score: total.score + article.signalScore * weight,
        weight: total.weight + weight,
      };
    },
    { score: 0, weight: 0 },
  );
  const normalizedScore =
    dedupedArticles.length > 0 ? weighted.score / Math.sqrt(dedupedArticles.length) : 0;
  const score = roundScore(normalizedScore);
  const positiveArticleCount = dedupedArticles.filter((article) => article.signal === "positive").length;
  const negativeArticleCount = dedupedArticles.filter((article) => article.signal === "negative").length;
  const neutralArticleCount = dedupedArticles.filter((article) => article.signal === "neutral").length;

  return {
    symbol: symbol.toUpperCase(),
    asOf,
    signal: signalFromScore(score),
    confidence: newsConfidence(dedupedArticles.length, publishers.length),
    score,
    articleCount: dedupedArticles.length,
    providerCount: providers.length,
    providers,
    failedProviders: Array.from(new Set(failedProviders)).sort(),
    publisherCount: publishers.length,
    publishers,
    positiveArticleCount,
    negativeArticleCount,
    neutralArticleCount,
    headlines: dedupedArticles.slice(0, 6).map((article) => `${article.source}: ${article.title}`),
    articles: dedupedArticles,
  };
}

function dedupeArticles(articles: NewsArticle[]) {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const urlKey = article.url || `${article.provider}:${article.title}`;
    const titleKey = article.title
      .replace(/\s+-\s+[a-z][a-z0-9 .&]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (seen.has(urlKey) || seen.has(titleKey)) {
      return false;
    }
    seen.add(urlKey);
    seen.add(titleKey);
    return true;
  });
}

function isRecentArticle(article: NewsArticle, asOf: string) {
  if (!article.publishedAt) {
    return true;
  }
  const ageDays = articleAgeDays(article.publishedAt, asOf);
  return ageDays <= NEWS_LOOKBACK_DAYS;
}

function compareArticlesByFreshness(left: NewsArticle, right: NewsArticle) {
  return (right.publishedAt || "").localeCompare(left.publishedAt || "");
}

function recencyWeight(publishedAt: string | undefined, asOf: string) {
  if (!publishedAt) {
    return 0.75;
  }
  const ageDays = articleAgeDays(publishedAt, asOf);
  if (ageDays <= 3) {
    return 1.25;
  }
  if (ageDays <= 7) {
    return 1;
  }
  if (ageDays <= 14) {
    return 0.75;
  }
  return 0.5;
}

function articleAgeDays(publishedAt: string, asOf: string) {
  const published = Date.parse(publishedAt);
  const reference = Date.parse(asOf);
  if (!Number.isFinite(published) || !Number.isFinite(reference)) {
    return 0;
  }
  return Math.max(0, (reference - published) / 86_400_000);
}

function newsConfidence(articleCount: number, publisherCount: number): "low" | "medium" | "high" {
  if (articleCount >= 10 && publisherCount >= 4) {
    return "high";
  }
  if (articleCount >= 8 && publisherCount >= 2) {
    return "high";
  }
  if (articleCount >= 4 || publisherCount >= 2) {
    return "medium";
  }
  return "low";
}

function signalFromScore(score: number): NewsSignal {
  if (score >= 1.5) {
    return "positive";
  }
  if (score <= -1.5) {
    return "negative";
  }
  return "neutral";
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}
