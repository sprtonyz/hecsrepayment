type ReviewBundleArticle = {
  id: string;
  title: string;
  source: string;
  provider: string;
  publishedAt?: string;
  collectedAt?: string;
  lastFetchedAt?: string;
  ageBucket: string;
  headlineRuleSignal: string;
  headlineRuleScore: number;
  matchedTerms: string[];
  summary?: string;
  articleTextStatus: "read" | "summaryOnly" | "unavailable";
  readableTextExcerpt: string;
  existingApiAnalysis?: {
    analyzedAt?: string;
    mode?: string;
    model?: string;
    escalatedModel?: string;
    signal: string;
    confidence: string;
    materiality: string;
    thesisImpactScore: number;
    category: string;
    timeHorizon: string;
    rationale: string;
    evidence?: string[];
    riskFlags?: string[];
    opportunities?: string[];
  };
};

type BuildCodexReviewBriefInput = {
  symbol: string;
  reviewMonth: string;
  requestedArticleCount: number;
  includedArticleCount: number;
  guideContext?: Record<string, unknown>;
  articles: ReviewBundleArticle[];
};

const DUPLICATE_DATE_WINDOW_DAYS = 14;

export function buildCodexReviewBrief({
  symbol,
  reviewMonth,
  requestedArticleCount,
  includedArticleCount,
  guideContext,
  articles,
}: BuildCodexReviewBriefInput) {
  const duplicateGroupByArticleId = duplicateGroupsByArticleId(articles);
  const articleReviewTable = articles.map((article) => {
    const duplicateGroup = duplicateGroupByArticleId.get(article.id);
    const likelyNoiseFlags = buildLikelyNoiseFlags(article, duplicateGroup);
    const durableThemeHints = buildDurableThemeHints(article);

    return {
      id: article.id,
      title: article.title,
      source: article.source,
      provider: article.provider,
      publishedAt: article.publishedAt,
      collectedAt: article.collectedAt,
      ageBucket: article.ageBucket,
      headlineRuleSignal: article.headlineRuleSignal,
      headlineRuleScore: article.headlineRuleScore,
      matchedTerms: article.matchedTerms,
      articleTextStatus: article.articleTextStatus,
      excerptChars: article.readableTextExcerpt.length,
      hasExistingApiAnalysis: Boolean(article.existingApiAnalysis),
      existingApiAnalysis: article.existingApiAnalysis
        ? {
            signal: article.existingApiAnalysis.signal,
            confidence: article.existingApiAnalysis.confidence,
            materiality: article.existingApiAnalysis.materiality,
            thesisImpactScore: article.existingApiAnalysis.thesisImpactScore,
            category: article.existingApiAnalysis.category,
            timeHorizon: article.existingApiAnalysis.timeHorizon,
          }
        : undefined,
      duplicateGroup,
      likelyNoiseFlags,
      durableThemeHints,
      reviewPriority: reviewPriority(article, likelyNoiseFlags, durableThemeHints),
    };
  });

  const likelyNoiseArticleCount = articleReviewTable.filter(
    (article) => article.likelyNoiseFlags.length > 0 && article.durableThemeHints.length === 0,
  ).length;

  return {
    purpose:
      "Start here before reading full excerpts. Use this brief to separate durable AAPL thesis signals from repeated links, summary-only items, and short-term market noise.",
    symbol: symbol.toUpperCase(),
    reviewMonth,
    guideSnapshot: buildGuideSnapshot(guideContext),
    coverage: {
      requestedArticleCount,
      includedArticleCount,
      articleTextStatusCounts: countBy(articles, (article) => article.articleTextStatus),
      providerCounts: countBy(articles, (article) => article.provider),
      publisherCounts: countBy(articles, (article) => article.source),
      ageBucketCounts: countBy(articles, (article) => article.ageBucket),
      existingApiAnalysisCount: articles.filter((article) => article.existingApiAnalysis).length,
      duplicateGroupCount: new Set(duplicateGroupByArticleId.values()).size,
      likelyNoiseArticleCount,
    },
    duplicateGroups: buildDuplicateGroups(articles),
    articleReviewTable,
    suggestedReviewFlow: [
      "Read guideSnapshot and coverage first to understand what the app was going to do before this review.",
      "Use articleReviewTable.reviewPriority to triage the bundle before opening long readableTextExcerpt fields.",
      "Downweight rows with likelyNoiseFlags unless their excerpt reveals a direct Apple business impact.",
      "For durableThemeHints, check the full excerpt and decide whether the guide signal, confidence, or deposit suggestion should change.",
      "If a codexReview already exists in this file, update it only if the new bundle evidence changes the materiality call.",
    ],
  };
}

function buildGuideSnapshot(guideContext: Record<string, unknown> | undefined) {
  const depositGuide = objectValue(guideContext, "depositGuide");
  const newsContext = objectValue(guideContext, "newsContext");

  return {
    generatedFrom: stringValue(guideContext, "generatedFrom"),
    generatedForDate: stringValue(guideContext, "generatedForDate"),
    depositGuide: pickRecord(depositGuide, [
      "direction",
      "confidence",
      "recommendedDepositAud",
      "remainingThisMonthAud",
      "minThisMonthAud",
      "maxThisMonthAud",
      "currentMonthContributedAud",
    ]),
    selectedNewsDigest: summarizeDigest(objectValue(newsContext, "selectedDigest")),
    headlineDigest: summarizeDigest(objectValue(newsContext, "headlineDigest")),
    aiDigest: summarizeDigest(objectValue(newsContext, "aiDigest")),
  };
}

function summarizeDigest(value: Record<string, unknown> | undefined) {
  if (!value) {
    return undefined;
  }

  return pickRecord(value, [
    "signal",
    "confidence",
    "score",
    "articleCount",
    "providerCount",
    "providers",
    "publisherCount",
    "publishers",
    "positiveArticleCount",
    "negativeArticleCount",
    "neutralArticleCount",
    "materialArticleCount",
    "highMaterialityCount",
    "escalatedCount",
    "analysisMode",
  ]);
}

function buildDuplicateGroups(articles: ReviewBundleArticle[]) {
  const groupedByTitle = new Map<string, ReviewBundleArticle[]>();
  for (const article of articles) {
    const key = normalizedTitle(article.title);
    const existing = groupedByTitle.get(key) ?? [];
    existing.push(article);
    groupedByTitle.set(key, existing);
  }

  const duplicateGroups = [];
  for (const [normalized, group] of groupedByTitle.entries()) {
    for (const dateCluster of clusterArticlesByDuplicateDate(group)) {
      if (dateCluster.length <= 1) {
        continue;
      }

      duplicateGroups.push({
        id: `duplicate-${duplicateGroups.length + 1}`,
        normalizedTitle: normalized,
        articleIds: dateCluster.map((article) => article.id),
        sources: Array.from(new Set(dateCluster.map((article) => article.source))).sort(),
        titles: Array.from(new Set(dateCluster.map((article) => article.title))),
      });
    }
  }

  return duplicateGroups;
}

function duplicateGroupsByArticleId(articles: ReviewBundleArticle[]) {
  const groups = buildDuplicateGroups(articles);
  const byArticleId = new Map<string, string>();
  for (const group of groups) {
    for (const articleId of group.articleIds) {
      byArticleId.set(articleId, group.id);
    }
  }
  return byArticleId;
}

function buildLikelyNoiseFlags(article: ReviewBundleArticle, duplicateGroup: string | undefined) {
  const text = `${article.title} ${article.source}`.toLowerCase();
  const flags: string[] = [];

  if (duplicateGroup) {
    flags.push("duplicate-title");
  }
  if (article.articleTextStatus !== "read") {
    flags.push(`${article.articleTextStatus}-text`);
  }
  if (/\balphaspace\b/.test(text)) {
    flags.push("platform-demo");
  }
  if (/\b(tokenized|tokenization|blockchain|metamask|defi|crypto)\b/.test(text)) {
    flags.push("market-plumbing");
  }
  if (/\b(technician|chart of the day|52-week high|buy, sell or hold|stock market)\b/.test(text)) {
    flags.push("market-action");
  }

  return flags;
}

function buildDurableThemeHints(article: ReviewBundleArticle) {
  const text = `${article.title} ${article.summary ?? ""}`.toLowerCase();
  const hints: string[] = [];

  if (/\b(app store|fortnite|epic|antitrust|lawsuit|court|regulator|commission|fee)\b/.test(text)) {
    hints.push("legal-regulatory");
  }
  if (/\b(ai|apple intelligence|siri|smart glasses|eyewear|xr)\b/.test(text)) {
    hints.push("ai-product-competition");
  }
  if (/\b(services|apple tv|sports|formula one|f1|world cup|app store)\b/.test(text)) {
    hints.push("services-growth");
  }
  if (/\b(earnings|revenue|sales|iphone|margin|valuation|p\/e|premium)\b/.test(text)) {
    hints.push("fundamentals-valuation");
  }

  return Array.from(new Set(hints));
}

function reviewPriority(
  article: ReviewBundleArticle,
  likelyNoiseFlags: string[],
  durableThemeHints: string[],
) {
  const apiMateriality = article.existingApiAnalysis?.materiality;
  if (apiMateriality === "high" || durableThemeHints.includes("legal-regulatory")) {
    return "high";
  }
  if (apiMateriality === "medium" || durableThemeHints.length > 0) {
    return "medium";
  }
  if (likelyNoiseFlags.length > 0) {
    return "low";
  }
  return "medium";
}

function countBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizedTitle(title: string) {
  return title
    .replace(/\s+-\s+[a-z][a-z0-9 .&']+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clusterArticlesByDuplicateDate(articles: ReviewBundleArticle[]) {
  const clusters: ReviewBundleArticle[][] = [];
  const sorted = [...articles].sort(
    (left, right) => duplicateTimestamp(left) - duplicateTimestamp(right),
  );

  for (const article of sorted) {
    const timestamp = duplicateTimestamp(article);
    const matchingCluster = clusters.find((cluster) =>
      cluster.some(
        (clusterArticle) =>
          Math.abs(timestamp - duplicateTimestamp(clusterArticle)) <=
          DUPLICATE_DATE_WINDOW_DAYS * 86_400_000,
      ),
    );

    if (matchingCluster) {
      matchingCluster.push(article);
    } else {
      clusters.push([article]);
    }
  }

  return clusters;
}

function duplicateTimestamp(article: ReviewBundleArticle) {
  for (const value of [article.publishedAt, article.collectedAt, article.lastFetchedAt]) {
    const timestamp = Date.parse(value ?? "");
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }
  return 0;
}

function objectValue(value: Record<string, unknown> | undefined, key: string) {
  const next = value?.[key];
  return next && typeof next === "object" && !Array.isArray(next)
    ? (next as Record<string, unknown>)
    : undefined;
}

function stringValue(value: Record<string, unknown> | undefined, key: string) {
  const next = value?.[key];
  return typeof next === "string" ? next : undefined;
}

function pickRecord(value: Record<string, unknown> | undefined, keys: string[]) {
  if (!value) {
    return undefined;
  }
  return keys.reduce<Record<string, unknown>>((picked, key) => {
    if (key in value) {
      picked[key] = value[key];
    }
    return picked;
  }, {});
}
