import { subMonths, format } from "date-fns";
import { nowIso, todayIso } from "@/lib/domain/dates";
import type {
  AppSettings,
  CachedDailyPrice,
  CachedDividend,
  CachedFxRate,
  CachedNewsAnalysis,
  CachedNewsArticle,
  CachedQuote,
  CachedSplit,
  Contribution,
  SaleEvent,
  TrackerSnapshot,
  Trade,
} from "@/lib/storage/types";

function id(prefix: string, value: string) {
  return `${prefix}-${value}`;
}

export function createDefaultSettings(): AppSettings {
  const now = nowIso();
  return {
    id: "singleton",
    baseTicker: "AAPL",
    displayCurrency: "AUD",
    baseValuationCurrency: "USD",
    contributionPlanCurrency: "AUD",
    planMonthlyContributionAud: 600,
    planStartDate: todayIso(),
    planYears: 5,
    includeDividends: true,
    dividendMode: "cash",
    includeSplits: true,
    defaultPriceMode: "live",
    marketDataProvider: "finnhub",
    studyLoanEnabled: true,
    studyLoanBalanceAud: 36000,
    studyLoanPayoffAmountAud: 36000,
    studyLoanMonthlyRepaymentAud: 594,
    studyLoanAnnualIncomeAud: 120000,
    studyLoanAnnualIndexationRatePercent: 3.2,
    studyLoanUseIncomeFormula: false,
    studyLoanRedirectFreedRepayment: true,
    showMonthlyCodexReview: false,
    showReviewerCharter: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDemoSnapshot(): TrackerSnapshot {
  const now = nowIso();
  const today = todayIso();
  const settings: AppSettings = {
    ...createDefaultSettings(),
    defaultPriceMode: "manual",
    marketDataProvider: "manual",
    manualCurrentPriceUsd: 205.5,
    planStartDate: format(subMonths(new Date(), 8), "yyyy-MM-dd"),
    isDemoMode: true,
    createdAt: now,
    updatedAt: now,
  };

  const saleEvents: SaleEvent[] = [
    {
      id: "demo-sale",
      ticker: "AAPL",
      saleDate: "2019-06-14",
      sharesSold: 50,
      salePricePerShareUsd: 440,
      grossProceedsUsd: 22000,
      feesUsd: 15,
      netProceedsUsd: 21985,
      notes: "Demo data: placeholder sale proceeds around 22,000 USD.",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const fxRateToUsd = 0.66;
  const contributions: Contribution[] = Array.from({ length: 8 }, (_, index) => {
    const date = format(subMonths(new Date(), 7 - index), "yyyy-MM-15");
    return {
      id: id("demo-contribution", date),
      date,
      amount: 600,
      currencyEntered: "AUD",
      fxRateToUsd,
      amountUsd: Number((600 * fxRateToUsd).toFixed(2)),
      notes: "Demo data",
      createdAt: now,
      updatedAt: now,
    };
  });

  const tradePrices = [188, 191, 186, 194, 199, 203, 201, 205];
  const trades: Trade[] = contributions.map((contribution, index) => {
    const shares = Number((contribution.amountUsd / tradePrices[index]).toFixed(6));
    return {
      id: id("demo-trade", contribution.date),
      date: contribution.date,
      ticker: "AAPL",
      side: "BUY",
      shares,
      pricePerShare: tradePrices[index],
      currencyEntered: "USD",
      fxRateToUsd: 1,
      pricePerShareUsd: tradePrices[index],
      grossAmountUsd: Number((shares * tradePrices[index]).toFixed(2)),
      feesUsd: 1,
      feeCurrency: "USD",
      totalAmountUsd: Number((shares * tradePrices[index] + 1).toFixed(2)),
      notes: "Demo data",
      createdAt: now,
      updatedAt: now,
    };
  });

  const quotes: CachedQuote[] = [
    {
      symbol: "AAPL",
      priceUsd: 205.5,
      asOf: now,
      provider: "manual",
      isDelayed: true,
      sourceNote: "Demo data manual price.",
    },
  ];

  const splits: CachedSplit[] = [
    {
      symbol: "AAPL",
      date: "2020-08-31",
      ratio: 4,
      fromFactor: 1,
      toFactor: 4,
      provider: "manual",
    },
  ];

  const dividends: CachedDividend[] = [
    ["2019-08-09", 0.77],
    ["2019-11-07", 0.77],
    ["2020-02-07", 0.77],
    ["2020-05-08", 0.82],
    ["2020-08-07", 0.82],
    ["2020-11-06", 0.205],
    ["2021-02-05", 0.205],
    ["2021-05-07", 0.22],
    ["2021-08-06", 0.22],
    ["2022-02-04", 0.22],
    ["2022-08-05", 0.23],
    ["2023-02-10", 0.23],
    ["2023-08-11", 0.24],
    ["2024-02-09", 0.24],
    ["2024-08-12", 0.25],
    ["2025-02-10", 0.25],
    ["2025-08-11", 0.26],
  ].map(([exDate, amount]) => ({
    symbol: "AAPL",
    exDate: exDate as string,
    amountPerShareUsd: amount as number,
    provider: "manual" as const,
  }));

  const dailyPrices: CachedDailyPrice[] = Array.from({ length: 30 }, (_, index) => {
    const date = format(subMonths(new Date(), 29 - index), "yyyy-MM-15");
    const closeUsd = Number((150 + index * 1.8 + Math.sin(index) * 5).toFixed(2));
    return {
      symbol: "AAPL",
      date,
      closeUsd,
      adjustedCloseUsd: closeUsd,
      provider: "manual",
    };
  });

  const fxRates: CachedFxRate[] = [
    {
      id: `USD-AUD-${today}`,
      base: "USD",
      quote: "AUD",
      date: today,
      rate: 1 / fxRateToUsd,
      asOf: now,
      provider: "manual",
    },
    {
      id: `AUD-USD-${today}`,
      base: "AUD",
      quote: "USD",
      date: today,
      rate: fxRateToUsd,
      asOf: now,
      provider: "manual",
    },
  ];

  const newsArticles: CachedNewsArticle[] = [
    {
      id: "demo-news-yahoo-1",
      symbol: "AAPL",
      title: "Apple stock rises as analysts point to steady services growth",
      summary: "Demo news item for the deposit guide.",
      url: "https://finance.yahoo.com/quote/AAPL/news/",
      source: "Yahoo Finance",
      provider: "yahooFinance",
      publishedAt: now,
      collectedAt: now,
      cachedAt: now,
      lastFetchedAt: now,
      signal: "positive",
      signalScore: 0.9,
      matchedTerms: ["growth"],
    },
    {
      id: "demo-news-google-1",
      symbol: "AAPL",
      title: "Apple faces antitrust scrutiny while demand stays resilient",
      summary: "Demo news item for the deposit guide.",
      url: "https://news.google.com/search?q=AAPL",
      source: "Google News",
      provider: "googleNews",
      publishedAt: now,
      collectedAt: now,
      cachedAt: now,
      lastFetchedAt: now,
      signal: "negative",
      signalScore: -0.9,
      matchedTerms: ["legal pressure"],
    },
  ];

  const newsAnalyses: CachedNewsAnalysis[] = [
    {
      id: "demo-news-yahoo-1-gpt-5.4-mini",
      articleId: "demo-news-yahoo-1",
      symbol: "AAPL",
      title: "Apple stock rises as analysts point to steady services growth",
      url: "https://finance.yahoo.com/quote/AAPL/news/",
      source: "Yahoo Finance",
      publishedAt: now,
      analyzedAt: now,
      analysisMode: "testing",
      primaryModel: "gpt-5.4-mini",
      finalModel: "gpt-5.4-mini",
      articleTextStatus: "summaryOnly",
      signal: "positive",
      confidence: "medium",
      materiality: "medium",
      thesisImpactScore: 1,
      category: "competitivePosition",
      timeHorizon: "mediumTerm",
      rationale: "Demo analysis: services growth can modestly support the long-term Apple thesis.",
      evidence: ["Analysts pointed to steady services growth."],
      riskFlags: [],
      opportunities: ["Services growth can improve recurring revenue quality."],
      shouldEscalate: false,
      escalationReason: "",
    },
    {
      id: "demo-news-google-1-gpt-5.4",
      articleId: "demo-news-google-1",
      symbol: "AAPL",
      title: "Apple faces antitrust scrutiny while demand stays resilient",
      url: "https://news.google.com/search?q=AAPL",
      source: "Google News",
      publishedAt: now,
      analyzedAt: now,
      analysisMode: "performance",
      primaryModel: "gpt-5.4-mini",
      finalModel: "gpt-5.4",
      escalatedModel: "gpt-5.4",
      articleTextStatus: "summaryOnly",
      signal: "negative",
      confidence: "medium",
      materiality: "high",
      thesisImpactScore: -2,
      category: "legalRegulatory",
      timeHorizon: "longTerm",
      rationale: "Demo analysis: antitrust scrutiny can be durable if it affects App Store economics.",
      evidence: ["The headline referenced antitrust scrutiny."],
      riskFlags: ["Regulatory pressure"],
      opportunities: ["Demand appeared resilient in the same item."],
      shouldEscalate: true,
      escalationReason: "High materiality regulatory risk.",
    },
  ];

  return {
    settings,
    saleEvents,
    contributions,
    trades,
    quotes,
    dailyPrices,
    dividends,
    splits,
    fxRates,
    newsArticles,
    newsAnalyses,
  };
}
