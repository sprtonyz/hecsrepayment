import { addMonthsIso } from "@/lib/domain/dates";
import { decimal, roundMoney, roundShares } from "@/lib/domain/money";

export type ProjectionAssumptions = {
  startDate: string;
  months: number;
  monthlyContributionAud: number;
  audUsdRate: number;
  annualGrowthRatePercent: number;
  annualDividendYieldPercent: number;
  includeDividends: boolean;
  startingPriceUsd: number;
  hadHeldShares: number;
  rebuildShares: number;
  rebuildCashUsd: number;
  hadHeldDividendCashUsd: number;
  rebuildDividendCashUsd: number;
};

export type ProjectionPoint = {
  date: string;
  priceUsd: number;
  hadHeldValueUsd: number;
  rebuildValueUsd: number;
  gapUsd: number;
  gapAud: number;
  rebuildShares: number;
};

export type ProjectionResult = {
  points: ProjectionPoint[];
  catchUpDate?: string;
  projectedGapUsd: number;
  projectedGapAud: number;
  requiredMonthlyContributionAud: number;
  assumedUsdToAudRate: number;
};

export function calculateMonthlyGrowthRate(annualGrowthRatePercent: number) {
  return Math.pow(1 + annualGrowthRatePercent / 100, 1 / 12) - 1;
}

export function projectCatchUp(assumptions: ProjectionAssumptions): ProjectionResult {
  const {
    startDate,
    months,
    monthlyContributionAud,
    audUsdRate,
    annualGrowthRatePercent,
    annualDividendYieldPercent,
    includeDividends,
    startingPriceUsd,
    hadHeldShares,
    rebuildCashUsd,
    hadHeldDividendCashUsd,
    rebuildDividendCashUsd,
  } = assumptions;

  const usdToAudRate = audUsdRate > 0 ? 1 / audUsdRate : 0;
  const monthlyGrowth = calculateMonthlyGrowthRate(annualGrowthRatePercent);
  const monthlyDividendYield = annualDividendYieldPercent / 100 / 12;
  const monthlyContributionUsd = decimal(monthlyContributionAud).mul(audUsdRate);
  let price = decimal(startingPriceUsd);
  let rebuildShares = decimal(assumptions.rebuildShares);
  let rebuildCash = decimal(rebuildCashUsd).plus(rebuildDividendCashUsd);
  let hadHeldCash = decimal(hadHeldDividendCashUsd);
  let catchUpDate: string | undefined;
  const points: ProjectionPoint[] = [];

  for (let month = 1; month <= months; month += 1) {
    const date = addMonthsIso(startDate, month);
    price = price.mul(1 + monthlyGrowth);

    if (monthlyContributionUsd.gt(0) && price.gt(0)) {
      rebuildShares = rebuildShares.plus(monthlyContributionUsd.div(price));
    }

    const hadHeldMarketValue = decimal(hadHeldShares).mul(price);
    const rebuildMarketValue = rebuildShares.mul(price);

    if (includeDividends && monthlyDividendYield > 0) {
      hadHeldCash = hadHeldCash.plus(hadHeldMarketValue.mul(monthlyDividendYield));
      rebuildCash = rebuildCash.plus(rebuildMarketValue.mul(monthlyDividendYield));
    }

    const hadHeldValueUsd = hadHeldMarketValue.plus(hadHeldCash);
    const rebuildValueUsd = rebuildMarketValue.plus(rebuildCash);
    const gapUsd = hadHeldValueUsd.minus(rebuildValueUsd);
    const gapAud = gapUsd.mul(usdToAudRate);

    const point = {
      date,
      priceUsd: roundMoney(price),
      hadHeldValueUsd: roundMoney(hadHeldValueUsd),
      rebuildValueUsd: roundMoney(rebuildValueUsd),
      gapUsd: roundMoney(gapUsd),
      gapAud: roundMoney(gapAud),
      rebuildShares: roundShares(rebuildShares),
    };
    points.push(point);

    if (!catchUpDate && point.gapUsd <= 0) {
      catchUpDate = date;
    }
  }

  const projectedGapUsd = points.at(-1)?.gapUsd ?? 0;
  const projectedGapAud = points.at(-1)?.gapAud ?? 0;
  const requiredMonthlyContributionAud = estimateRequiredMonthlyAudContribution(
    assumptions,
    0,
    Math.max(monthlyContributionAud * 4, monthlyContributionAud + Math.max(projectedGapAud, 0) / Math.max(months, 1) + 1000),
  );

  return {
    points,
    catchUpDate,
    projectedGapUsd,
    projectedGapAud,
    requiredMonthlyContributionAud,
    assumedUsdToAudRate: usdToAudRate,
  };
}

function estimateRequiredMonthlyAudContribution(
  assumptions: ProjectionAssumptions,
  low: number,
  high: number,
) {
  if (assumptions.months <= 0) {
    return 0;
  }

  const withCurrent = projectCatchUpWithoutRequirement(assumptions);
  if ((withCurrent.points.at(-1)?.gapUsd ?? 0) <= 0) {
    return roundMoney(assumptions.monthlyContributionAud);
  }

  let upper = high;
  for (let tries = 0; tries < 8; tries += 1) {
    const result = projectCatchUpWithoutRequirement({
      ...assumptions,
      monthlyContributionAud: upper,
    });
    if ((result.points.at(-1)?.gapUsd ?? 0) <= 0) {
      break;
    }
    upper *= 2;
  }

  let left = low;
  let right = upper;
  for (let i = 0; i < 36; i += 1) {
    const mid = (left + right) / 2;
    const result = projectCatchUpWithoutRequirement({
      ...assumptions,
      monthlyContributionAud: mid,
    });
    if ((result.points.at(-1)?.gapUsd ?? 0) <= 0) {
      right = mid;
    } else {
      left = mid;
    }
  }

  return roundMoney(right);
}

function projectCatchUpWithoutRequirement(assumptions: ProjectionAssumptions) {
  const {
    startDate,
    months,
    monthlyContributionAud,
    audUsdRate,
    annualGrowthRatePercent,
    annualDividendYieldPercent,
    includeDividends,
    startingPriceUsd,
    hadHeldShares,
    rebuildCashUsd,
    hadHeldDividendCashUsd,
    rebuildDividendCashUsd,
  } = assumptions;

  const usdToAudRate = audUsdRate > 0 ? 1 / audUsdRate : 0;
  const monthlyGrowth = calculateMonthlyGrowthRate(annualGrowthRatePercent);
  const monthlyDividendYield = annualDividendYieldPercent / 100 / 12;
  const monthlyContributionUsd = decimal(monthlyContributionAud).mul(audUsdRate);
  let price = decimal(startingPriceUsd);
  let rebuildShares = decimal(assumptions.rebuildShares);
  let rebuildCash = decimal(rebuildCashUsd).plus(rebuildDividendCashUsd);
  let hadHeldCash = decimal(hadHeldDividendCashUsd);
  const points: ProjectionPoint[] = [];

  for (let month = 1; month <= months; month += 1) {
    const date = addMonthsIso(startDate, month);
    price = price.mul(1 + monthlyGrowth);
    if (price.gt(0)) {
      rebuildShares = rebuildShares.plus(monthlyContributionUsd.div(price));
    }
    const hadHeldMarketValue = decimal(hadHeldShares).mul(price);
    const rebuildMarketValue = rebuildShares.mul(price);
    if (includeDividends && monthlyDividendYield > 0) {
      hadHeldCash = hadHeldCash.plus(hadHeldMarketValue.mul(monthlyDividendYield));
      rebuildCash = rebuildCash.plus(rebuildMarketValue.mul(monthlyDividendYield));
    }
    const hadHeldValueUsd = hadHeldMarketValue.plus(hadHeldCash);
    const rebuildValueUsd = rebuildMarketValue.plus(rebuildCash);
    const gapUsd = hadHeldValueUsd.minus(rebuildValueUsd);
    points.push({
      date,
      priceUsd: roundMoney(price),
      hadHeldValueUsd: roundMoney(hadHeldValueUsd),
      rebuildValueUsd: roundMoney(rebuildValueUsd),
      gapUsd: roundMoney(gapUsd),
      gapAud: roundMoney(gapUsd.mul(usdToAudRate)),
      rebuildShares: roundShares(rebuildShares),
    });
  }

  return { points };
}
