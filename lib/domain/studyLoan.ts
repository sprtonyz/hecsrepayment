import { addMonths, format, getMonth, parseISO } from "date-fns";
import { decimal, roundMoney } from "@/lib/domain/money";

export type StudyLoanRepaymentBand = {
  min: number;
  max?: number;
  base: number;
  marginalRate: number;
  threshold: number;
  totalIncomeRate?: number;
};

export const STUDY_LOAN_2025_26_BANDS: StudyLoanRepaymentBand[] = [
  { min: 0, max: 67000, base: 0, marginalRate: 0, threshold: 0 },
  { min: 67001, max: 125000, base: 0, marginalRate: 0.15, threshold: 67000 },
  { min: 125001, max: 179285, base: 8700, marginalRate: 0.17, threshold: 125000 },
  {
    min: 179286,
    base: 0,
    marginalRate: 0,
    threshold: 0,
    totalIncomeRate: 0.1,
  },
];

export type StudyLoanProjectionInput = {
  startDate: string;
  months: number;
  startingBalanceAud: number;
  monthlyRepaymentAud: number;
  annualIndexationRatePercent: number;
};

export type StudyLoanProjectionPoint = {
  date: string;
  balanceAud: number;
  repaymentAud: number;
  indexationAud: number;
};

export type StudyLoanProjection = {
  points: StudyLoanProjectionPoint[];
  paidOffDate?: string;
  totalPaidAud: number;
  totalIndexationAud: number;
  endingBalanceAud: number;
};

export type StudyLoanIndexationRange = {
  lowRatePercent: number;
  baseRatePercent: number;
  highRatePercent: number;
  low: StudyLoanProjection;
  base: StudyLoanProjection;
  high: StudyLoanProjection;
  earliestPaidOffDate?: string;
  latestPaidOffDate?: string;
};

export type FreedRepaymentProjectionInput = {
  startDate: string;
  months: number;
  monthlyFreedCashAud: number;
  audUsdRate: number;
  startingPriceUsd: number;
  annualGrowthRatePercent: number;
};

export type FreedRepaymentProjection = {
  futureShares: number;
  futureValueUsd: number;
  futureValueAud: number;
};

export function calculateStudyLoanAnnualRepaymentAud(incomeAud: number) {
  const band = STUDY_LOAN_2025_26_BANDS.find(
    (item) => incomeAud >= item.min && (item.max === undefined || incomeAud <= item.max),
  );

  if (!band) {
    return 0;
  }

  if (band.totalIncomeRate) {
    return roundMoney(decimal(incomeAud).mul(band.totalIncomeRate));
  }

  const repayment = decimal(band.base).plus(
    decimal(Math.max(0, incomeAud - band.threshold)).mul(band.marginalRate),
  );
  return roundMoney(repayment);
}

export function calculateStudyLoanMonthlyRepaymentAud(incomeAud: number) {
  return roundMoney(decimal(calculateStudyLoanAnnualRepaymentAud(incomeAud)).div(12));
}

export function projectStudyLoanDebt(input: StudyLoanProjectionInput): StudyLoanProjection {
  const {
    startDate,
    months,
    startingBalanceAud,
    monthlyRepaymentAud,
    annualIndexationRatePercent,
  } = input;
  let balance = decimal(startingBalanceAud);
  let totalPaid = decimal(0);
  let totalIndexation = decimal(0);
  let paidOffDate: string | undefined;
  const points: StudyLoanProjectionPoint[] = [];

  for (let month = 0; month < months; month += 1) {
    const date = addMonths(parseISO(startDate), month);
    const isoDate = format(date, "yyyy-MM-dd");
    let indexation = decimal(0);

    if (balance.gt(0) && getMonth(date) === 5) {
      indexation = balance.mul(annualIndexationRatePercent).div(100);
      balance = balance.plus(indexation);
      totalIndexation = totalIndexation.plus(indexation);
    }

    const repayment = DecimalMin(balance, decimal(monthlyRepaymentAud));
    balance = balance.minus(repayment);
    totalPaid = totalPaid.plus(repayment);

    if (!paidOffDate && balance.lte(0)) {
      paidOffDate = isoDate;
    }

    points.push({
      date: isoDate,
      balanceAud: roundMoney(balance),
      repaymentAud: roundMoney(repayment),
      indexationAud: roundMoney(indexation),
    });
  }

  return {
    points,
    paidOffDate,
    totalPaidAud: roundMoney(totalPaid),
    totalIndexationAud: roundMoney(totalIndexation),
    endingBalanceAud: roundMoney(balance),
  };
}

export function estimateStudyLoanIndexationRangePercent(baseRatePercent: number) {
  return {
    lowRatePercent: roundMoney(Math.max(0, baseRatePercent - 0.8)),
    baseRatePercent: roundMoney(baseRatePercent),
    highRatePercent: roundMoney(baseRatePercent + 1.6),
  };
}

export function projectStudyLoanDebtRange(
  input: StudyLoanProjectionInput,
): StudyLoanIndexationRange {
  const range = estimateStudyLoanIndexationRangePercent(
    input.annualIndexationRatePercent,
  );
  const low = projectStudyLoanDebt({
    ...input,
    annualIndexationRatePercent: range.lowRatePercent,
  });
  const base = projectStudyLoanDebt({
    ...input,
    annualIndexationRatePercent: range.baseRatePercent,
  });
  const high = projectStudyLoanDebt({
    ...input,
    annualIndexationRatePercent: range.highRatePercent,
  });

  return {
    ...range,
    low,
    base,
    high,
    earliestPaidOffDate: low.paidOffDate,
    latestPaidOffDate: high.paidOffDate,
  };
}

export function projectFreedRepaymentIntoAapl(
  input: FreedRepaymentProjectionInput,
): FreedRepaymentProjection {
  const monthlyGrowth =
    Math.pow(1 + input.annualGrowthRatePercent / 100, 1 / 12) - 1;
  const monthlyContributionUsd = decimal(input.monthlyFreedCashAud).mul(input.audUsdRate);
  let shares = decimal(0);
  let price = decimal(input.startingPriceUsd);

  for (let month = 1; month <= input.months; month += 1) {
    price = price.mul(1 + monthlyGrowth);
    if (price.gt(0)) {
      shares = shares.plus(monthlyContributionUsd.div(price));
    }
  }

  const futureValueUsd = shares.mul(price);
  const usdToAudRate = input.audUsdRate > 0 ? 1 / input.audUsdRate : 0;

  return {
    futureShares: shares.toDecimalPlaces(6).toNumber(),
    futureValueUsd: roundMoney(futureValueUsd),
    futureValueAud: roundMoney(futureValueUsd.mul(usdToAudRate)),
  };
}

function DecimalMin(left: ReturnType<typeof decimal>, right: ReturnType<typeof decimal>) {
  return left.lessThan(right) ? left : right;
}
