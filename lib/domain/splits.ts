import { decimal, roundShares } from "@/lib/domain/money";
import type { CachedSplit } from "@/lib/storage/types";

export function splitRatio(split: Pick<CachedSplit, "ratio" | "fromFactor" | "toFactor">) {
  if (split.ratio && split.ratio > 0) {
    return decimal(split.ratio);
  }
  if (split.fromFactor <= 0) {
    return decimal(1);
  }
  return decimal(split.toFactor).div(split.fromFactor);
}

export function splitsInRange(
  splits: CachedSplit[],
  afterDateExclusive: string,
  onOrBeforeDateInclusive: string,
) {
  return splits
    .filter((split) => split.date > afterDateExclusive && split.date <= onOrBeforeDateInclusive)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function cumulativeSplitFactorAfterDate(
  splits: CachedSplit[],
  afterDateExclusive: string,
  onOrBeforeDateInclusive: string,
) {
  return splitsInRange(splits, afterDateExclusive, onOrBeforeDateInclusive).reduce(
    (factor, split) => factor.mul(splitRatio(split)),
    decimal(1),
  );
}

export function adjustSharesForSplits(
  shares: number,
  splits: CachedSplit[],
  fromDateExclusive: string,
  toDateInclusive: string,
) {
  return roundShares(
    decimal(shares).mul(
      cumulativeSplitFactorAfterDate(splits, fromDateExclusive, toDateInclusive),
    ),
  );
}
