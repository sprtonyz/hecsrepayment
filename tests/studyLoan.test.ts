import { describe, expect, it } from "vitest";
import {
  calculateStudyLoanAnnualRepaymentAud,
  calculateStudyLoanMonthlyRepaymentAud,
  projectFreedRepaymentIntoAapl,
  projectStudyLoanDebt,
  projectStudyLoanDebtRange,
} from "@/lib/domain/studyLoan";

describe("study loan decision model", () => {
  it("uses the 2025-26 marginal repayment formula", () => {
    expect(calculateStudyLoanAnnualRepaymentAud(67000)).toBe(0);
    expect(calculateStudyLoanAnnualRepaymentAud(120000)).toBe(7950);
    expect(calculateStudyLoanMonthlyRepaymentAud(120000)).toBe(662.5);
    expect(calculateStudyLoanAnnualRepaymentAud(130000)).toBe(9550);
  });

  it("projects June indexation and monthly repayments", () => {
    const result = projectStudyLoanDebt({
      startDate: "2026-05-20",
      months: 3,
      startingBalanceAud: 36000,
      monthlyRepaymentAud: 594,
      annualIndexationRatePercent: 3,
    });

    expect(result.points[0].balanceAud).toBe(35406);
    expect(result.points[1].indexationAud).toBe(1062.18);
    expect(result.totalIndexationAud).toBe(1062.18);
  });

  it("projects freed repayments invested into AAPL", () => {
    const result = projectFreedRepaymentIntoAapl({
      startDate: "2026-05-20",
      months: 12,
      monthlyFreedCashAud: 594,
      audUsdRate: 0.66,
      startingPriceUsd: 200,
      annualGrowthRatePercent: 0,
    });

    expect(result.futureValueUsd).toBe(4704.48);
    expect(result.futureValueAud).toBe(7128);
  });

  it("projects a safe indexation payoff range", () => {
    const result = projectStudyLoanDebtRange({
      startDate: "2026-05-20",
      months: 120,
      startingBalanceAud: 36000,
      monthlyRepaymentAud: 594,
      annualIndexationRatePercent: 3.2,
    });

    expect(result.lowRatePercent).toBe(2.4);
    expect(result.highRatePercent).toBe(4.8);
    expect(result.earliestPaidOffDate).toBeTruthy();
    expect(result.latestPaidOffDate).toBeTruthy();
  });
});
