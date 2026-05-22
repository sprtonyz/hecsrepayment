import { describe, expect, it } from "vitest";
import {
  calculateCashBalanceUsd,
  calculateCatchUpMetrics,
  calculateCurrentRebuildShares,
  calculateRequiredMonthlyContributionAud,
} from "@/lib/domain/calculations";
import { formatCurrency } from "@/lib/domain/money";
import {
  contributionFixture,
  dividendFixture,
  saleFixture,
  settingsFixture,
  splitFixture,
  tradeFixture,
} from "./fixtures";

describe("catch-up calculations", () => {
  const metrics = calculateCatchUpMetrics({
    settings: settingsFixture,
    saleEvent: saleFixture,
    contributions: contributionFixture,
    trades: tradeFixture,
    dividends: dividendFixture,
    splits: splitFixture,
    currentPriceUsd: 100,
    latestUsdToAudRate: 1.5,
    asOfDate: "2026-05-20",
  });

  it("calculates the Catch-Up Gap", () => {
    expect(metrics.hadHeldTotalValueUsd).toBe(4020);
    expect(metrics.rebuildTotalValueUsd).toBe(1094);
    expect(metrics.catchUpGapUsd).toBe(2926);
    expect(metrics.catchUpGapAud).toBe(4389);
  });

  it("calculates rebuild portfolio shares and value", () => {
    expect(calculateCurrentRebuildShares(tradeFixture, splitFixture, "AAPL", "2026-05-20")).toBe(8);
    expect(metrics.rebuildMarketValueUsd).toBe(800);
    expect(metrics.rebuildDividendCashUsd).toBe(4);
  });

  it("starts catch-up progress at zero after setup before any rebuild activity is logged", () => {
    const setupOnlyMetrics = calculateCatchUpMetrics({
      settings: settingsFixture,
      saleEvent: saleFixture,
      contributions: [],
      trades: [],
      dividends: dividendFixture,
      splits: splitFixture,
      currentPriceUsd: 100,
      latestUsdToAudRate: 1.5,
      asOfDate: "2026-05-20",
    });

    expect(setupOnlyMetrics.rebuildTotalValueUsd).toBe(0);
    expect(setupOnlyMetrics.catchUpProgressPercent).toBe(0);
  });

  it("calculates cash balance", () => {
    expect(calculateCashBalanceUsd(contributionFixture, tradeFixture)).toBe(290);
  });

  it("calculates AUD contribution pace", () => {
    expect(metrics.monthsElapsed).toBe(5);
    expect(metrics.expectedContributionsToDateAud).toBe(3000);
    expect(metrics.actualContributionsAud).toBe(600);
    expect(metrics.paceDifferenceAud).toBe(-2400);
  });

  it("calculates required monthly AUD contribution", () => {
    expect(calculateRequiredMonthlyContributionAud(2926, 56, 1.5)).toBe(78.38);
    expect(metrics.requiredMonthlyContributionAud).toBe(78.38);
  });

  it("formats USD and AUD currency", () => {
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "AUD")).toBe("A$1,234.50");
  });
});
