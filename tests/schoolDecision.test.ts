import { describe, expect, it } from "vitest";
import {
  buildSchoolDecisionCompoundTimeline,
  buildCurrentMonthSchoolDecision,
  buildSchoolDecisionTimeline,
} from "@/lib/domain/schoolDecision";

describe("school repayment decision timeline", () => {
  it("compares keep AAPL against pay off debt and rebuild month by month", () => {
    const result = buildSchoolDecisionTimeline({
      asOfDate: "2026-05-20",
      currentHadHeldTotalUsd: 40000,
      currentRebuildTotalUsd: 5000,
      currentSchoolDebtAud: 36000,
      debtAfterPayoffAud: 0,
      monthlyRepaymentAud: 594,
      usdToAudRate: 1.5,
      keepAaplProjection: [
        {
          date: "2026-06-20",
          priceUsd: 205,
          hadHeldValueUsd: 40500,
          rebuildValueUsd: 5600,
          gapUsd: 34900,
          gapAud: 52350,
          rebuildShares: 20,
        },
      ],
      cashOutRebuildProjection: [
        {
          date: "2026-06-20",
          priceUsd: 205,
          hadHeldValueUsd: 40500,
          rebuildValueUsd: 6500,
          gapUsd: 34000,
          gapAud: 51000,
          rebuildShares: 25,
        },
      ],
      schoolDebtProjection: [
        {
          date: "2026-06-20",
          balanceAud: 35400,
          repaymentAud: 594,
          indexationAud: 0,
        },
      ],
      months: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].keepAaplNetAud).toBe(59406);
    expect(result[0].cashOutRebuildNetAud).toBe(7500);
    expect(result[0].verdict).toBe("keepAapl");
    expect(result[1].keepAaplNetAud).toBe(60156);
    expect(result[1].cashOutRebuildNetAud).toBe(9750);
    expect(result[1].schoolDebtAud).toBe(35400);
  });

  it("compares the current month as kept AAPL after monthly repayment versus rebuilt AAPL", () => {
    const result = buildCurrentMonthSchoolDecision({
      asOfDate: "2026-05-20",
      currentHadHeldTotalUsd: 24000,
      originalSaleProceedsUsd: 22000,
      currentRebuildAssetValueUsd: 0,
      currentSchoolDebtAud: 36000,
      debtAfterPayoffAud: 0,
      totalContributionsAud: 0,
      latestUsdToAudRate: 1.5,
      monthlyEducationRepaymentAud: 594,
      currentMonthContributionAud: 0,
      targetMonthContributionAud: 600,
      hasCurrentValuation: true,
    });

    expect(result.keepAaplStartingValueAud).toBe(33000);
    expect(result.keepAaplValueAud).toBe(36000);
    expect(result.keepAaplMovementAud).toBe(3000);
    expect(result.monthlyEducationRepaymentAud).toBe(594);
    expect(result.keepAaplDebtAud).toBe(35406);
    expect(result.keepAaplNetAud).toBe(35406);
    expect(result.aaplDepositAud).toBe(600);
    expect(result.currentMonthDepositTopUpAud).toBe(600);
    expect(result.cashOutRebuildNetAud).toBe(600);
    expect(result.verdict).toBe("keepAapl");
  });

  it("does not treat a missing current price as a full AAPL loss", () => {
    const result = buildCurrentMonthSchoolDecision({
      asOfDate: "2026-05-20",
      currentHadHeldTotalUsd: 0,
      originalSaleProceedsUsd: 22000,
      currentRebuildAssetValueUsd: 360,
      currentSchoolDebtAud: 36000,
      debtAfterPayoffAud: 0,
      totalContributionsAud: 540,
      latestUsdToAudRate: 1.5,
      monthlyEducationRepaymentAud: 594,
      currentMonthContributionAud: 540,
      targetMonthContributionAud: 600,
      hasCurrentValuation: false,
    });

    expect(result.keepAaplStartingValueAud).toBe(33000);
    expect(result.keepAaplMovementAud).toBe(0);
    expect(result.keepAaplValueAud).toBe(33000);
    expect(result.keepAaplDebtAud).toBe(35406);
    expect(result.keepAaplNetAud).toBe(32406);
    expect(result.rebuildAssetValueAud).toBe(540);
    expect(result.rebuildMovementAud).toBe(0);
    expect(result.aaplDepositAud).toBe(600);
    expect(result.currentMonthDepositTopUpAud).toBe(60);
    expect(result.cashOutRebuildNetAud).toBe(600);
  });

  it("projects the school decision as a cash-flow-adjusted opportunity timeline", () => {
    const result = buildSchoolDecisionCompoundTimeline({
      startDate: "2026-05-20",
      months: 2,
      keepStartingValueAud: 36000,
      rebuildStartingValueAud: 600,
      monthlyContributionAud: 600,
      currentSchoolDebtAud: 36000,
      debtAfterPayoffAud: 0,
      monthlyDebtRepaymentAud: 600,
      annualDebtIndexationRatePercent: 0,
      annualGrowthRatePercent: 12,
    });

    expect(result).toHaveLength(3);
    expect(result[0].keepAaplNetAud).toBe(35400);
    expect(result[0].cashOutRebuildNetAud).toBe(600);
    expect(result[1].schoolDebtAud).toBe(34800);
    expect(result[1].cashOutRebuildNetAud).toBeGreaterThan(1200);
    expect(result[2].cashOutRebuildNetAud).toBeGreaterThan(result[1].cashOutRebuildNetAud + 600);
  });
});
