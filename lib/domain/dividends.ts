import { decimal, roundMoney } from "@/lib/domain/money";
import { adjustSharesForSplits } from "@/lib/domain/splits";
import type { CachedDividend, CachedSplit, SaleEvent, Trade } from "@/lib/storage/types";

export function calculateHadHeldDividendCashUsd(
  saleEvent: SaleEvent | undefined,
  dividends: CachedDividend[],
  splits: CachedSplit[],
  asOfDate: string,
) {
  if (!saleEvent) {
    return 0;
  }

  const total = dividends
    .filter(
      (dividend) =>
        dividend.symbol === saleEvent.ticker &&
        dividend.exDate > saleEvent.saleDate &&
        dividend.exDate <= asOfDate,
    )
    .reduce((cash, dividend) => {
      const sharesOnExDate = adjustSharesForSplits(
        saleEvent.sharesSold,
        splits,
        saleEvent.saleDate,
        dividend.exDate,
      );
      return cash.plus(decimal(sharesOnExDate).mul(dividend.amountPerShareUsd));
    }, decimal(0));

  return roundMoney(total);
}

export function calculateSharesHeldOnDate(
  trades: Trade[],
  splits: CachedSplit[],
  ticker: string,
  asOfDate: string,
) {
  return trades
    .filter((trade) => trade.ticker === ticker && trade.date <= asOfDate)
    .reduce((shares, trade) => {
      const adjusted = adjustSharesForSplits(trade.shares, splits, trade.date, asOfDate);
      return trade.side === "BUY" ? shares.plus(adjusted) : shares.minus(adjusted);
    }, decimal(0))
    .toDecimalPlaces(6)
    .toNumber();
}

export function calculateRebuildDividendCashUsd(
  trades: Trade[],
  dividends: CachedDividend[],
  splits: CachedSplit[],
  ticker: string,
  asOfDate: string,
) {
  const total = dividends
    .filter(
      (dividend) =>
        dividend.symbol === ticker && dividend.exDate <= asOfDate,
    )
    .reduce((cash, dividend) => {
      const sharesOnExDate = calculateSharesHeldOnDate(
        trades,
        splits,
        ticker,
        dividend.exDate,
      );
      if (sharesOnExDate <= 0) {
        return cash;
      }
      return cash.plus(decimal(sharesOnExDate).mul(dividend.amountPerShareUsd));
    }, decimal(0));

  return roundMoney(total);
}
