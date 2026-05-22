import Decimal from "decimal.js";
import type { Currency } from "@/lib/storage/types";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Decimalish = Decimal.Value;

export function decimal(value: Decimalish) {
  return new Decimal(value || 0);
}

export function toNumber(value: Decimalish, places = 8) {
  return decimal(value).toDecimalPlaces(places).toNumber();
}

export function roundMoney(value: Decimalish) {
  return toNumber(value, 2);
}

export function roundShares(value: Decimalish) {
  return toNumber(value, 6);
}

export function roundPercent(value: Decimalish, places = 2) {
  return toNumber(value, places);
}

export function sum(values: Decimalish[]) {
  return values.reduce<Decimal>((total, value) => total.plus(decimal(value)), new Decimal(0));
}

export function audToUsd(amountAud: Decimalish, audUsdRate: Decimalish) {
  return decimal(amountAud).mul(audUsdRate);
}

export function usdToAud(amountUsd: Decimalish, usdAudRate: Decimalish) {
  return decimal(amountUsd).mul(usdAudRate);
}

export function convertToUsd(
  amount: Decimalish,
  currency: Currency,
  fxRateToUsd: Decimalish,
) {
  return currency === "USD" ? decimal(amount) : audToUsd(amount, fxRateToUsd);
}

export function formatCurrency(
  value: Decimalish,
  currency: Currency,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(decimal(value).toNumber());
}

export function formatCompactCurrency(value: Decimalish, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(decimal(value).toNumber());
}

export function formatShares(value: Decimalish) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(decimal(value).toNumber());
}

export function formatPercent(value: Decimalish, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(decimal(value).toNumber());
}
