import { addMonths, differenceInCalendarMonths, format, parseISO } from "date-fns";
import { roundMoney } from "@/lib/domain/money";
import type { CachedDailyPrice, Contribution } from "@/lib/storage/types";

export type DepositGuideDirection = "increase" | "hold" | "decrease";
export type DepositGuideConfidence = "low" | "medium" | "high";
export type DepositGuideNewsSignal = "positive" | "neutral" | "negative";

export type DepositGuideNewsInput = {
  signal: DepositGuideNewsSignal;
  confidence: DepositGuideConfidence;
  articleCount: number;
  providerCount: number;
  providers: string[];
  failedProviders?: string[];
  publisherCount?: number;
  publishers?: string[];
  score?: number;
  headlines?: string[];
  positiveArticleCount?: number;
  negativeArticleCount?: number;
  neutralArticleCount?: number;
  materialArticleCount?: number;
  highMaterialityCount?: number;
  escalatedCount?: number;
  analysisMode?: "headlineRules" | "aiArticleAnalysis" | "codexReview";
};

export type DepositGuideInput = {
  planMonthlyContributionAud: number;
  contributions: Contribution[];
  dailyPrices: CachedDailyPrice[];
  currentPriceUsd: number;
  latestUsdToAudRate: number;
  asOfDate: string;
  planStartDate?: string;
  lookbackMonths?: number;
  newsSignal?: DepositGuideNewsSignal;
  news?: DepositGuideNewsInput;
};

export type DepositGuideResult = {
  direction: DepositGuideDirection;
  confidence: DepositGuideConfidence;
  flexPercent: number;
  adjustmentPercent: number;
  adjustmentAud: number;
  signalScore: number;
  recommendedDepositAud: number;
  remainingThisMonthAud: number;
  minThisMonthAud: number;
  maxThisMonthAud: number;
  baseFlexAud: number;
  bankedFlexAud: number;
  currentMonthContributedAud: number;
  trendPercent: number;
  pullbackFromRecentHighPercent: number;
  volatilityPercent: number;
  reasons: string[];
  sources: string[];
};

export function calculateDepositGuide(input: DepositGuideInput): DepositGuideResult {
  const {
    planMonthlyContributionAud,
    contributions,
    dailyPrices,
    currentPriceUsd,
    latestUsdToAudRate,
    asOfDate,
    planStartDate,
    lookbackMonths = 12,
    newsSignal = "neutral",
    news,
  } = input;
  const currentMonthKey = monthKey(asOfDate);
  const currentMonthContributedAud = contributionTotalForMonthAud(
    contributions,
    currentMonthKey,
    latestUsdToAudRate,
  );
  const priceSignal = calculatePriceSignal(dailyPrices, currentPriceUsd, asOfDate);
  const effectiveNewsSignal = news?.signal ?? newsSignal;
  const confidence = calculateConfidence(priceSignal, news);
  const flexPercent = 0.2;
  const baseFlexAud = roundMoney(planMonthlyContributionAud * flexPercent);
  const minThisMonthAud = Math.max(0, roundMoney(planMonthlyContributionAud - baseFlexAud));
  const bankedFlexAud = calculateBankedFlexAud(
    contributions,
    planMonthlyContributionAud,
    baseFlexAud,
    asOfDate,
    planStartDate,
    latestUsdToAudRate,
    lookbackMonths,
  );
  const maxThisMonthAud = roundMoney(planMonthlyContributionAud + baseFlexAud + bankedFlexAud);
  const signalScore = calculateSignalScore(priceSignal, effectiveNewsSignal, news);
  const adjustmentRatio = calculateAdjustmentRatio(signalScore, confidence);
  const adjustmentAud = calculateAdjustmentAud(adjustmentRatio, baseFlexAud, bankedFlexAud);
  const recommendedDepositAud = clampMoney(
    planMonthlyContributionAud + adjustmentAud,
    minThisMonthAud,
    maxThisMonthAud,
  );
  const adjustmentPercent =
    planMonthlyContributionAud > 0 ? roundMoney((adjustmentAud / planMonthlyContributionAud) * 100) : 0;
  const direction =
    adjustmentPercent >= 2.5 ? "increase" : adjustmentPercent <= -2.5 ? "decrease" : "hold";
  const remainingThisMonthAud = Math.max(
    0,
    roundMoney(recommendedDepositAud - currentMonthContributedAud),
  );
  const reasons = buildReasons(
    direction,
    priceSignal,
    effectiveNewsSignal,
    bankedFlexAud,
    news,
    adjustmentPercent,
    signalScore,
  );
  const sources = buildSources(dailyPrices, contributions, currentPriceUsd, news);

  return {
    direction,
    confidence,
    flexPercent,
    adjustmentPercent,
    adjustmentAud: roundMoney(adjustmentAud),
    signalScore,
    recommendedDepositAud: roundMoney(recommendedDepositAud),
    remainingThisMonthAud,
    minThisMonthAud,
    maxThisMonthAud,
    baseFlexAud,
    bankedFlexAud,
    currentMonthContributedAud,
    trendPercent: priceSignal.trendPercent,
    pullbackFromRecentHighPercent: priceSignal.pullbackFromRecentHighPercent,
    volatilityPercent: priceSignal.volatilityPercent,
    reasons,
    sources,
  };
}

function calculateBankedFlexAud(
  contributions: Contribution[],
  planMonthlyContributionAud: number,
  baseFlexAud: number,
  asOfDate: string,
  planStartDate: string | undefined,
  latestUsdToAudRate: number,
  lookbackMonths: number,
) {
  const asOf = parseISO(asOfDate);
  const planStartMonth = monthKey(
    planStartDate ?? format(addMonths(asOf, -lookbackMonths), "yyyy-MM-dd"),
  );
  let banked = 0;
  for (let offset = lookbackMonths; offset >= 1; offset -= 1) {
    const date = addMonths(asOf, -offset);
    const month = format(date, "yyyy-MM");
    if (month < planStartMonth) {
      continue;
    }
    const total = contributionTotalForMonthAud(
      contributions,
      month,
      latestUsdToAudRate,
    );
    const unused = Math.max(0, planMonthlyContributionAud - total);
    banked += Math.min(baseFlexAud, unused);
  }
  return roundMoney(banked);
}

function contributionTotalForMonthAud(
  contributions: Contribution[],
  month: string,
  latestUsdToAudRate: number,
) {
  return roundMoney(
    contributions
      .filter((contribution) => monthKey(contribution.date) === month)
      .reduce((total, contribution) => {
        if (contribution.currencyEntered === "AUD") {
          return total + contribution.amount;
        }
        return total + contribution.amountUsd * latestUsdToAudRate;
      }, 0),
  );
}

function calculatePriceSignal(
  dailyPrices: CachedDailyPrice[],
  currentPriceUsd: number,
  asOfDate: string,
) {
  const sortedPrices = dailyPrices
    .filter((price) => price.date <= asOfDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const prices = [
    ...sortedPrices.map((price) => ({
      date: price.date,
      close: price.adjustedCloseUsd ?? price.closeUsd,
    })),
    ...(currentPriceUsd > 0 ? [{ date: asOfDate, close: currentPriceUsd }] : []),
  ];
  const uniquePrices = prices.filter(
    (price, index, list) => index === 0 || price.date !== list[index - 1].date,
  );
  const latestPoint = uniquePrices.at(-1);
  const latest = latestPoint?.close ?? 0;
  const high = Math.max(...uniquePrices.map((price) => price.close), latest || 0);
  const comparison = findComparisonPrice(uniquePrices, asOfDate, 6);
  const trendPercent =
    latest > 0 && comparison.close > 0
      ? roundMoney(((latest - comparison.close) / comparison.close) * 100)
      : 0;
  const pullbackFromRecentHighPercent =
    latest > 0 && high > 0 ? roundMoney(((latest - high) / high) * 100) : 0;
  const returns = uniquePrices.slice(1).map((price, index) => {
    const previous = uniquePrices[index].close;
    return previous > 0 ? (price.close - previous) / previous : 0;
  });
  const averageReturn =
    returns.length > 0 ? returns.reduce((total, value) => total + value, 0) / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((total, value) => total + (value - averageReturn) ** 2, 0) /
        (returns.length - 1)
      : 0;
  const monthsCovered = uniquePrices.length > 1
    ? Math.max(
        1,
        differenceInCalendarMonths(
          parseISO(uniquePrices.at(-1)?.date ?? asOfDate),
          parseISO(uniquePrices[0].date),
        ),
      )
    : 1;
  const observationsPerYear = Math.max(1, (returns.length / monthsCovered) * 12);
  const volatilityPercent = roundMoney(Math.sqrt(variance) * Math.sqrt(observationsPerYear) * 100);

  return {
    observations: uniquePrices.length,
    comparisonDate: comparison.date,
    latestDate: latestPoint?.date,
    trendPercent,
    pullbackFromRecentHighPercent,
    volatilityPercent,
  };
}

function findComparisonPrice(
  prices: Array<{ date: string; close: number }>,
  asOfDate: string,
  monthsBack: number,
) {
  const target = format(addMonths(parseISO(asOfDate), -monthsBack), "yyyy-MM-dd");
  return (
    [...prices]
      .reverse()
      .find((price) => price.date <= target) ??
    prices[0] ?? {
      date: asOfDate,
      close: 0,
    }
  );
}

function calculateSignalScore(
  signal: ReturnType<typeof calculatePriceSignal>,
  newsSignal: DepositGuideNewsSignal,
  news: DepositGuideNewsInput | undefined,
) {
  const pullbackScore = clamp(-signal.pullbackFromRecentHighPercent / 8, 0, 1.25);
  const downtrendScore = clamp(-signal.trendPercent / 10, 0, 1);
  const momentumPenalty = clamp((signal.trendPercent - 12) / 12, 0, 1);
  const volatilityPenalty = clamp((signal.volatilityPercent - 24) / 16, 0, 1);
  const newsScore =
    typeof news?.score === "number"
      ? clamp(news.score / 1.5, -1.25, 1.25)
      : newsSignal === "positive"
        ? 0.75
        : newsSignal === "negative"
          ? -0.75
          : 0;
  return roundScore(
    pullbackScore + downtrendScore - momentumPenalty - volatilityPenalty + newsScore,
  );
}

function calculateAdjustmentRatio(
  signalScore: number,
  confidence: DepositGuideConfidence,
) {
  const confidenceScale = confidence === "high" ? 1 : confidence === "medium" ? 0.75 : 0.35;
  return clamp((signalScore / 2) * confidenceScale, -1, 1);
}

function calculateAdjustmentAud(
  adjustmentRatio: number,
  baseFlexAud: number,
  bankedFlexAud: number,
) {
  if (adjustmentRatio >= 0) {
    const bankedFlexActivation = clamp((adjustmentRatio - 0.75) / 0.25, 0, 1);
    return roundMoney(baseFlexAud * adjustmentRatio + bankedFlexAud * bankedFlexActivation);
  }
  return roundMoney(baseFlexAud * adjustmentRatio);
}

function calculateConfidence(
  signal: ReturnType<typeof calculatePriceSignal>,
  news: DepositGuideNewsInput | undefined,
): DepositGuideConfidence {
  let rank = signal.observations >= 7 ? 2 : signal.observations >= 4 ? 1 : 0;
  if (news && news.articleCount > 0) {
    if (news.analysisMode === "codexReview") {
      rank = Math.max(rank, confidenceRank(news.confidence));
    } else if (news.articleCount >= 6 && news.providerCount >= 2) {
      rank += 1;
    } else if (rank === 0 && news.articleCount >= 3) {
      rank = 1;
    }
  }
  if (rank >= 2) {
    return "high";
  }
  if (rank >= 1) {
    return "medium";
  }
  return "low";
}

function confidenceRank(confidence: DepositGuideConfidence) {
  if (confidence === "high") {
    return 2;
  }
  if (confidence === "medium") {
    return 1;
  }
  return 0;
}

function buildReasons(
  direction: DepositGuideDirection,
  signal: ReturnType<typeof calculatePriceSignal>,
  newsSignal: DepositGuideNewsSignal,
  bankedFlexAud: number,
  news: DepositGuideNewsInput | undefined,
  adjustmentPercent: number,
  signalScore: number,
) {
  const reasons = buildPriceSignalReasons(signal);
  if (bankedFlexAud > 0) {
    reasons.push(`Unused 20% monthly flexibility bank: A$${bankedFlexAud.toFixed(2)}.`);
  }
  reasons.push(
    `Guide adjustment: ${formatSignedPercent(adjustmentPercent)} from the neutral monthly plan inside the guardrail (signal score ${signalScore.toFixed(2)}).`,
  );
  if (news && news.articleCount > 0) {
    const newsLabel =
      news.analysisMode === "aiArticleAnalysis"
        ? "AI article-analysis"
        : news.analysisMode === "codexReview"
          ? "Codex-reviewed news"
          : "News";
    const hasMaterialityReview =
      news.analysisMode === "aiArticleAnalysis" || news.analysisMode === "codexReview";
    const coverageCount = news.publisherCount ?? news.providerCount;
    const coverageLabel = news.publisherCount ? "publisher" : "source";
    reasons.push(
      `${newsLabel} signal is ${newsSignal} from ${news.articleCount} recent article${news.articleCount === 1 ? "" : "s"} across ${coverageCount} ${coverageLabel}${coverageCount === 1 ? "" : "s"}.`,
    );
    reasons.push(
      `News balance: ${news.positiveArticleCount ?? 0} positive, ${news.negativeArticleCount ?? 0} negative, and ${news.neutralArticleCount ?? 0} neutral article${news.articleCount === 1 ? "" : "s"}.`,
    );
    if (hasMaterialityReview) {
      reasons.push(
        `Materiality review: ${news.materialArticleCount ?? 0} material article${news.materialArticleCount === 1 ? "" : "s"}, including ${news.highMaterialityCount ?? 0} high-impact item${news.highMaterialityCount === 1 ? "" : "s"} and ${news.escalatedCount ?? 0} gpt-5.4 escalation${news.escalatedCount === 1 ? "" : "s"}.`,
      );
    }
  } else if (news?.failedProviders?.length) {
    reasons.push(`News providers were checked but did not return usable headlines.`);
  } else if (newsSignal === "neutral") {
    reasons.push("News signal is neutral until a news provider is connected.");
  } else {
    reasons.push(`News signal is ${newsSignal}.`);
  }
  if (direction === "increase") {
    reasons.push("Guide leans higher because the blended signal supports using some monthly flex.");
  }
  if (direction === "decrease") {
    reasons.push("Guide leans lower because the blended signal supports saving some monthly flex.");
  }
  return reasons;
}

function buildPriceSignalReasons(signal: ReturnType<typeof calculatePriceSignal>) {
  if (signal.observations < 7) {
    return [
      `6-month price trend: unavailable until at least 7 cached/current price points exist (${signal.observations} found).`,
      `Pullback from recent high: unavailable until enough cached price history is available.`,
      `Estimated annualized volatility: unavailable until enough cached price history is available.`,
    ];
  }

  const observationText = `${signal.observations} cached/current price point${
    signal.observations === 1 ? "" : "s"
  }`;

  return [
    `6-month price trend: ${signal.trendPercent.toFixed(1)}% using ${observationText}.`,
    `Pullback from recent high: ${signal.pullbackFromRecentHighPercent.toFixed(1)}% using ${observationText}.`,
    `Estimated annualized volatility: ${signal.volatilityPercent.toFixed(1)}% using ${observationText}.`,
  ];
}

function buildSources(
  dailyPrices: CachedDailyPrice[],
  contributions: Contribution[],
  currentPriceUsd: number,
  news: DepositGuideNewsInput | undefined,
) {
  const providers = Array.from(new Set(dailyPrices.map((price) => price.provider)));
  const sources = [
    `${dailyPrices.length} cached AAPL price point${dailyPrices.length === 1 ? "" : "s"}${providers.length > 0 ? ` from ${providers.join(", ")}` : ""}.`,
    `Current tracker AAPL price: US$${currentPriceUsd.toFixed(2)}.`,
    `${contributions.length} saved contribution${contributions.length === 1 ? "" : "s"} from your local ledger.`,
  ];
  if (news && news.articleCount > 0) {
    const newsProviderNames = (news.publishers ?? news.providers).map(formatNewsProviderName);
    const sourceLabel =
      news.analysisMode === "aiArticleAnalysis"
        ? "AI-analyzed news sources"
        : news.analysisMode === "codexReview"
          ? "Codex-reviewed article publishers"
          : "News sources";
    sources.push(
      `${sourceLabel}: ${newsProviderNames.join(", ")} (${news.articleCount} recent article${news.articleCount === 1 ? "" : "s"}).`,
    );
    if (news.publishers?.length && news.providers.length > 0) {
      sources.push(
        `News provider feeds checked: ${news.providers.map(formatNewsProviderName).join(", ")}.`,
      );
    }
    if (news.failedProviders?.length) {
      sources.push(
        `News providers unavailable during the last refresh: ${news.failedProviders.map(formatNewsProviderName).join(", ")}.`,
      );
    }
    for (const headline of news.headlines?.slice(0, 6) ?? []) {
      sources.push(`Headline checked: ${headline}.`);
    }
  } else {
    sources.push("News source: no recent free-news headline cache yet. Refresh market data to fetch news.");
  }
  return sources;
}

function formatNewsProviderName(provider: string) {
  if (provider === "yahooFinance") {
    return "Yahoo Finance";
  }
  if (provider === "googleNews") {
    return "Google News";
  }
  if (provider.startsWith("googleNews")) {
    return provider
      .replace(/^googleNews/, "Google News ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim();
  }
  if (provider === "appleNewsroom") {
    return "Apple Newsroom";
  }
  return provider;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function clampMoney(value: number, min: number, max: number) {
  return roundMoney(clamp(value, min, max));
}

function formatSignedPercent(value: number) {
  if (Math.abs(value) < 0.01) {
    return "0.00%";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function roundScore(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function monthKey(date: string) {
  return format(parseISO(date), "yyyy-MM");
}
