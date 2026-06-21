import { describe, expect, it } from "vitest";
import { calculateDepositGuide } from "@/lib/domain/depositGuide";
import type { CachedDailyPrice, Contribution } from "@/lib/storage/types";

describe("monthly deposit guide", () => {
  it("rolls unused 20 percent flex into later month maximums", () => {
    const contributions: Contribution[] = [
      contribution("2026-01-15", 480),
      contribution("2026-02-15", 480),
    ];

    const result = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions,
      dailyPrices: prices([220, 210, 200, 190, 180, 170]),
      currentPriceUsd: 170,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-03-20",
      lookbackMonths: 2,
    });

    expect(result.baseFlexAud).toBe(120);
    expect(result.bankedFlexAud).toBe(240);
    expect(result.maxThisMonthAud).toBe(960);
    expect(result.minThisMonthAud).toBe(480);
  });

  it("uses current-month contributions to calculate remaining deposit", () => {
    const result = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [contribution("2026-05-02", 300)],
      dailyPrices: prices([180, 181, 182, 183, 184, 185]),
      currentPriceUsd: 185,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
    });

    expect(result.currentMonthContributedAud).toBe(300);
    expect(result.remainingThisMonthAud).toBe(300);
  });

  it("uses free-news context to boost confidence and explain the guide", () => {
    const priceOnly = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [],
      dailyPrices: prices([210, 205, 200, 195]),
      currentPriceUsd: 190,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
    });
    const withNews = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [],
      dailyPrices: prices([210, 205, 200, 195]),
      currentPriceUsd: 190,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
      lookbackMonths: 0,
      news: {
        signal: "positive",
        confidence: "high",
        articleCount: 8,
        providerCount: 3,
        providers: ["Yahoo Finance", "Google News", "Apple Newsroom"],
        score: 2.1,
        headlines: ["Yahoo Finance: Apple beats estimates"],
        positiveArticleCount: 6,
        negativeArticleCount: 1,
        neutralArticleCount: 1,
      },
    });

    expect(priceOnly.confidence).toBe("medium");
    expect(withNews.confidence).toBe("high");
    expect(withNews.direction).toBe("increase");
    expect(withNews.recommendedDepositAud).toBe(720);
    expect(withNews.reasons.some((reason) => reason.includes("News signal is positive"))).toBe(true);
    expect(withNews.sources.some((source) => source.includes("Headline checked"))).toBe(true);
  });

  it("uses an explicit Codex review tilt when present", () => {
    const result = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [],
      dailyPrices: prices([210, 210, 210, 210]),
      currentPriceUsd: 210,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
      news: {
        signal: "positive",
        confidence: "high",
        articleCount: 9,
        providerCount: 4,
        providers: ["appleNewsroom", "googleNews", "yahooFinance"],
        score: 2.5,
        expectedAdjustmentPercent: 15,
        analysisMode: "codexReview",
      },
    });

    expect(result.adjustmentPercent).toBe(15);
    expect(result.recommendedDepositAud).toBe(690);
    expect(
      result.reasons.some((reason) => reason.includes("Codex review tilt")),
    ).toBe(true);
  });

  it("uses Codex-reviewed monthly news without treating raw headline volume as stronger signal", () => {
    const result = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [],
      dailyPrices: prices([210, 210, 210, 210]),
      currentPriceUsd: 210,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
      lookbackMonths: 0,
      news: {
        signal: "neutral",
        confidence: "medium",
        articleCount: 6,
        providerCount: 3,
        providers: ["appleNewsroom", "googleNews", "yahooFinance"],
        publisherCount: 5,
        publishers: ["Apple Newsroom", "CNBC", "European Commission", "MacRumors", "Yahoo Finance"],
        score: -0.2,
        headlines: ["Yahoo Finance: Apple Faces Renewed App Store Fight as Fortnite Returns"],
        positiveArticleCount: 2,
        negativeArticleCount: 2,
        neutralArticleCount: 2,
        materialArticleCount: 5,
        highMaterialityCount: 1,
        escalatedCount: 0,
        analysisMode: "codexReview",
      },
    });

    expect(result.confidence).toBe("medium");
    expect(result.direction).toBe("hold");
    expect(result.recommendedDepositAud).toBe(594);
    expect(result.adjustmentPercent).toBe(-1);
    expect(
      result.reasons.some((reason) => reason.includes("Codex-reviewed news signal is neutral")),
    ).toBe(true);
    expect(
      result.reasons.some((reason) => reason.includes("Materiality review: 5 material articles")),
    ).toBe(true);
    expect(
      result.sources.some((source) => source.includes("Codex-reviewed article publishers")),
    ).toBe(true);
  });

  it("nudges deposits continuously for modest reviewed-news scores", () => {
    const result = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [],
      dailyPrices: prices([210, 210, 210, 210]),
      currentPriceUsd: 210,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
      news: {
        signal: "neutral",
        confidence: "medium",
        articleCount: 12,
        providerCount: 5,
        providers: ["appleNewsroom", "googleNewsProducts", "googleNewsRegulatory"],
        publisherCount: 8,
        publishers: ["Apple Newsroom", "CNBC", "Reuters", "The Verge"],
        score: 1,
        headlines: ["Reuters: Apple services growth offsets iPhone concerns"],
        positiveArticleCount: 6,
        negativeArticleCount: 4,
        neutralArticleCount: 2,
        materialArticleCount: 10,
        highMaterialityCount: 2,
        escalatedCount: 1,
        analysisMode: "codexReview",
      },
    });

    expect(result.direction).toBe("increase");
    expect(result.adjustmentPercent).toBe(5);
    expect(result.recommendedDepositAud).toBe(630);
  });

  it("does not present missing price history as a flat 0 percent market reading", () => {
    const result = calculateDepositGuide({
      planMonthlyContributionAud: 600,
      contributions: [],
      dailyPrices: [],
      currentPriceUsd: 210,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
    });

    expect(result.trendPercent).toBe(0);
    expect(result.pullbackFromRecentHighPercent).toBe(0);
    expect(result.volatilityPercent).toBe(0);
    expect(result.reasons[0]).toContain("unavailable");
    expect(result.reasons[0]).toContain("7 cached/current price points");
    expect(result.reasons[0]).toContain("1 found");
  });
});

function contribution(date: string, amount: number): Contribution {
  return {
    id: date,
    date,
    amount,
    currencyEntered: "AUD",
    fxRateToUsd: 0.66,
    amountUsd: amount * 0.66,
    createdAt: date,
    updatedAt: date,
  };
}

function prices(values: number[]): CachedDailyPrice[] {
  const dates = [
    "2025-09-15",
    "2025-10-15",
    "2025-11-15",
    "2025-12-15",
    "2026-01-15",
    "2026-02-15",
    "2026-03-15",
    "2026-04-15",
  ];
  return values.map((value, index) => ({
    symbol: "AAPL",
    date: dates[index],
    closeUsd: value,
    provider: "manual",
  }));
}
