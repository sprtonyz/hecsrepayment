import type { Currency } from "@/lib/storage/types";

export type FxRate = {
  base: Currency;
  quote: Currency;
  rate: number;
  date: string;
  asOf: string;
  provider: "frankfurter" | "manual";
  sourceNote?: string;
};

export type FxProvider = {
  getRate(base: Currency, quote: Currency, date?: string): Promise<FxRate>;
};
