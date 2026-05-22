import { describe, expect, it } from "vitest";
import { projectCatchUp } from "@/lib/domain/projections";

describe("projection calculations", () => {
  it("projects catch-up date when AUD contributions buy enough USD AAPL exposure", () => {
    const result = projectCatchUp({
      startDate: "2026-05-20",
      months: 12,
      monthlyContributionAud: 600,
      audUsdRate: 0.65,
      annualGrowthRatePercent: 0,
      annualDividendYieldPercent: 0,
      includeDividends: false,
      startingPriceUsd: 100,
      hadHeldShares: 40,
      rebuildShares: 8,
      rebuildCashUsd: 0,
      hadHeldDividendCashUsd: 0,
      rebuildDividendCashUsd: 0,
    });

    expect(result.catchUpDate).toBe("2027-02-20");
    expect(result.points.at(-1)?.rebuildValueUsd).toBe(5480);
    expect(result.points.at(-1)?.gapUsd).toBe(-1480);
  });

  it("returns a required monthly AUD contribution for the target date", () => {
    const result = projectCatchUp({
      startDate: "2026-05-20",
      months: 48,
      monthlyContributionAud: 100,
      audUsdRate: 0.65,
      annualGrowthRatePercent: 6,
      annualDividendYieldPercent: 0.5,
      includeDividends: true,
      startingPriceUsd: 100,
      hadHeldShares: 40,
      rebuildShares: 1,
      rebuildCashUsd: 0,
      hadHeldDividendCashUsd: 0,
      rebuildDividendCashUsd: 0,
    });

    expect(result.requiredMonthlyContributionAud).toBeGreaterThan(100);
    expect(result.projectedGapUsd).toBeGreaterThan(0);
  });
});
