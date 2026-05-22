import { decimal, roundMoney, roundPercent, roundShares, sum } from "@/lib/domain/money";
import { calculateHadHeldDividendCashUsd, calculateRebuildDividendCashUsd } from "@/lib/domain/dividends";
import { monthsElapsedInclusive, monthsRemainingInclusive, targetEndDate } from "@/lib/domain/dates";
import { adjustSharesForSplits } from "@/lib/domain/splits";
import type {
  AppSettings,
  CachedDailyPrice,
  CachedDividend,
  CachedSplit,
  Contribution,
  SaleEvent,
  Trade,
} from "@/lib/storage/types";

export type CatchUpInputs = {
  settings: AppSettings;
  saleEvent?: SaleEvent;
  contributions: Contribution[];
  trades: Trade[];
  dividends: CachedDividend[];
  splits: CachedSplit[];
  currentPriceUsd: number;
  latestUsdToAudRate: number;
  asOfDate: string;
};

export type CatchUpMetrics = {
  equivalentSharesToday: number;
  hadHeldMarketValueUsd: number;
  hadHeldDividendCashUsd: number;
  hadHeldTotalValueUsd: number;
  currentRebuildShares: number;
  rebuildMarketValueUsd: number;
  rebuildDividendCashUsd: number;
  cashBalanceUsd: number;
  rebuildTotalValueUsd: number;
  catchUpGapUsd: number;
  catchUpGapAud: number;
  catchUpProgressPercent: number;
  saleNetProceedsUsd: number;
  depositProgressPercent: number;
  portfolioGainUsd: number;
  opportunityCostSinceSaleUsd: number;
  expectedContributionsToDateAud: number;
  actualContributionsAud: number;
  totalContributionsUsd: number;
  expectedContributionsToDateUsdEstimate: number;
  paceDifferenceAud: number;
  monthsElapsed: number;
  monthsRemaining: number;
  requiredMonthlyContributionAud: number;
  requiredMonthlyContributionUsd: number;
  planTargetDate: string;
};

export function calculateEquivalentSharesToday(
  saleEvent: SaleEvent | undefined,
  splits: CachedSplit[],
  asOfDate: string,
) {
  if (!saleEvent) {
    return 0;
  }
  return adjustSharesForSplits(saleEvent.sharesSold, splits, saleEvent.saleDate, asOfDate);
}

export function calculateCurrentRebuildShares(
  trades: Trade[],
  splits: CachedSplit[],
  ticker: string,
  asOfDate: string,
) {
  return roundShares(
    trades
      .filter((trade) => trade.ticker === ticker && trade.date <= asOfDate)
      .reduce((shares, trade) => {
        const adjusted = adjustSharesForSplits(trade.shares, splits, trade.date, asOfDate);
        return trade.side === "BUY" ? shares.plus(adjusted) : shares.minus(adjusted);
      }, decimal(0)),
  );
}

export function calculateTotalContributionsUsd(contributions: Contribution[]) {
  return roundMoney(sum(contributions.map((contribution) => contribution.amountUsd)));
}

export function calculateActualContributionsAud(
  contributions: Contribution[],
  latestUsdToAudRate: number,
) {
  return roundMoney(
    contributions.reduce((total, contribution) => {
      if (contribution.currencyEntered === "AUD") {
        return total.plus(contribution.amount);
      }
      return total.plus(decimal(contribution.amountUsd).mul(latestUsdToAudRate));
    }, decimal(0)),
  );
}

export function calculateTradeCashFlows(trades: Trade[]) {
  return trades.reduce(
    (flows, trade) => {
      const gross = decimal(trade.grossAmountUsd);
      const fees = decimal(trade.feesUsd);
      if (trade.side === "BUY") {
        return {
          buyCostUsd: flows.buyCostUsd.plus(gross).plus(fees),
          sellProceedsUsd: flows.sellProceedsUsd,
          totalFeesUsd: flows.totalFeesUsd.plus(fees),
        };
      }
      return {
        buyCostUsd: flows.buyCostUsd,
        sellProceedsUsd: flows.sellProceedsUsd.plus(gross).minus(fees),
        totalFeesUsd: flows.totalFeesUsd.plus(fees),
      };
    },
    {
      buyCostUsd: decimal(0),
      sellProceedsUsd: decimal(0),
      totalFeesUsd: decimal(0),
    },
  );
}

export function calculateCashBalanceUsd(contributions: Contribution[], trades: Trade[]) {
  const totalContributionsUsd = decimal(calculateTotalContributionsUsd(contributions));
  const flows = calculateTradeCashFlows(trades);
  return roundMoney(totalContributionsUsd.minus(flows.buyCostUsd).plus(flows.sellProceedsUsd));
}

export function calculateRequiredMonthlyContributionAud(
  catchUpGapUsd: number,
  monthsRemaining: number,
  latestUsdToAudRate: number,
) {
  if (catchUpGapUsd <= 0 || monthsRemaining <= 0) {
    return 0;
  }
  return roundMoney(decimal(catchUpGapUsd).div(monthsRemaining).mul(latestUsdToAudRate));
}

export function calculateCatchUpMetrics(inputs: CatchUpInputs): CatchUpMetrics {
  const {
    settings,
    saleEvent,
    contributions,
    trades,
    dividends,
    splits,
    currentPriceUsd,
    latestUsdToAudRate,
    asOfDate,
  } = inputs;
  const ticker = settings.baseTicker;

  const equivalentSharesToday = calculateEquivalentSharesToday(saleEvent, splits, asOfDate);
  const hadHeldMarketValueUsd = roundMoney(decimal(equivalentSharesToday).mul(currentPriceUsd));
  const hadHeldDividendCashUsd =
    settings.includeDividends && settings.dividendMode === "cash"
      ? calculateHadHeldDividendCashUsd(saleEvent, dividends, splits, asOfDate)
      : 0;
  const hadHeldTotalValueUsd = roundMoney(
    decimal(hadHeldMarketValueUsd).plus(hadHeldDividendCashUsd),
  );

  const currentRebuildShares = calculateCurrentRebuildShares(trades, splits, ticker, asOfDate);
  const rebuildMarketValueUsd = roundMoney(decimal(currentRebuildShares).mul(currentPriceUsd));
  const rebuildDividendCashUsd = settings.includeDividends
    ? calculateRebuildDividendCashUsd(trades, dividends, splits, ticker, asOfDate)
    : 0;
  const cashBalanceUsd = calculateCashBalanceUsd(contributions, trades);
  const rebuildTotalValueUsd = roundMoney(
    decimal(rebuildMarketValueUsd).plus(cashBalanceUsd).plus(rebuildDividendCashUsd),
  );

  const catchUpGapUsd = roundMoney(decimal(hadHeldTotalValueUsd).minus(rebuildTotalValueUsd));
  const catchUpGapAud = roundMoney(decimal(catchUpGapUsd).mul(latestUsdToAudRate));
  const catchUpProgressPercent =
    hadHeldTotalValueUsd > 0
      ? roundPercent(decimal(rebuildTotalValueUsd).div(hadHeldTotalValueUsd).mul(100), 2)
      : 0;

  const saleNetProceedsUsd = saleEvent?.netProceedsUsd ?? 0;
  const totalContributionsUsd = calculateTotalContributionsUsd(contributions);
  const depositProgressPercent =
    saleNetProceedsUsd > 0
      ? roundPercent(decimal(totalContributionsUsd).div(saleNetProceedsUsd).mul(100), 2)
      : 0;
  const portfolioGainUsd = roundMoney(decimal(rebuildTotalValueUsd).minus(totalContributionsUsd));
  const opportunityCostSinceSaleUsd = roundMoney(
    decimal(hadHeldTotalValueUsd).minus(saleNetProceedsUsd),
  );

  const monthsElapsed = monthsElapsedInclusive(settings.planStartDate, asOfDate);
  const expectedContributionsToDateAud = roundMoney(
    decimal(monthsElapsed).mul(settings.planMonthlyContributionAud),
  );
  const actualContributionsAud = calculateActualContributionsAud(
    contributions,
    latestUsdToAudRate,
  );
  const paceDifferenceAud = roundMoney(
    decimal(actualContributionsAud).minus(expectedContributionsToDateAud),
  );
  const expectedContributionsToDateUsdEstimate = roundMoney(
    decimal(expectedContributionsToDateAud).div(latestUsdToAudRate),
  );
  const monthsRemaining = monthsRemainingInclusive(
    settings.planStartDate,
    settings.planYears,
    asOfDate,
  );
  const requiredMonthlyContributionAud = calculateRequiredMonthlyContributionAud(
    catchUpGapUsd,
    monthsRemaining,
    latestUsdToAudRate,
  );
  const requiredMonthlyContributionUsd =
    requiredMonthlyContributionAud > 0
      ? roundMoney(decimal(requiredMonthlyContributionAud).div(latestUsdToAudRate))
      : 0;

  return {
    equivalentSharesToday,
    hadHeldMarketValueUsd,
    hadHeldDividendCashUsd,
    hadHeldTotalValueUsd,
    currentRebuildShares,
    rebuildMarketValueUsd,
    rebuildDividendCashUsd,
    cashBalanceUsd,
    rebuildTotalValueUsd,
    catchUpGapUsd,
    catchUpGapAud,
    catchUpProgressPercent,
    saleNetProceedsUsd,
    depositProgressPercent,
    portfolioGainUsd,
    opportunityCostSinceSaleUsd,
    expectedContributionsToDateAud,
    actualContributionsAud,
    totalContributionsUsd,
    expectedContributionsToDateUsdEstimate,
    paceDifferenceAud,
    monthsElapsed,
    monthsRemaining,
    requiredMonthlyContributionAud,
    requiredMonthlyContributionUsd,
    planTargetDate: targetEndDate(settings.planStartDate, settings.planYears),
  };
}

export type ValueSeriesPoint = {
  date: string;
  hadHeldUsd: number;
  rebuildUsd: number;
  gapUsd: number;
};

export function buildHistoricalValueSeries(
  settings: AppSettings,
  saleEvent: SaleEvent | undefined,
  contributions: Contribution[],
  trades: Trade[],
  dividends: CachedDividend[],
  splits: CachedSplit[],
  dailyPrices: CachedDailyPrice[],
  fallbackPriceUsd: number,
  latestUsdToAudRate: number,
  asOfDate: string,
): ValueSeriesPoint[] {
  const prices = dailyPrices
    .filter((price) => price.symbol === settings.baseTicker)
    .sort((a, b) => a.date.localeCompare(b.date));

  const sampled = prices.length > 0 ? prices.slice(-18) : [];
  const points: CachedDailyPrice[] =
    sampled.length > 0
      ? sampled
      : Array.from({ length: 8 }, (_, index) => ({
          symbol: settings.baseTicker,
          date: index === 7 ? asOfDate : `${new Date().getFullYear()}-${String(index + 1).padStart(2, "0")}-01`,
          closeUsd: fallbackPriceUsd * (0.82 + index * 0.025),
          provider: "manual" as const,
        }));

  return points.map((price) => {
    const metrics = calculateCatchUpMetrics({
      settings,
      saleEvent,
      contributions: contributions.filter((contribution) => contribution.date <= price.date),
      trades: trades.filter((trade) => trade.date <= price.date),
      dividends: dividends.filter((dividend) => dividend.exDate <= price.date),
      splits: settings.includeSplits ? splits.filter((split) => split.date <= price.date) : [],
      currentPriceUsd: price.adjustedCloseUsd ?? price.closeUsd,
      latestUsdToAudRate,
      asOfDate: price.date,
    });
    return {
      date: price.date,
      hadHeldUsd: metrics.hadHeldTotalValueUsd,
      rebuildUsd: metrics.rebuildTotalValueUsd,
      gapUsd: metrics.catchUpGapUsd,
    };
  });
}
