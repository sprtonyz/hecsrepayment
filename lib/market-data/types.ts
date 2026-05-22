import type { MarketProviderName } from "@/lib/storage/types";

export type Quote = {
  symbol: string;
  price: number;
  currency: "USD";
  asOf: string;
  provider: MarketProviderName;
  isDelayed?: boolean;
  sourceNote?: string;
};

export type DailyPrice = {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose?: number;
  volume?: number;
  provider: MarketProviderName;
};

export type DividendEvent = {
  symbol: string;
  exDate: string;
  payDate?: string;
  amountPerShare: number;
  currency: "USD";
  provider: MarketProviderName;
};

export type SplitEvent = {
  symbol: string;
  date: string;
  fromFactor: number;
  toFactor: number;
  ratio: number;
  provider: MarketProviderName;
};

export type MarketDataProvider = {
  getQuote(symbol: string): Promise<Quote>;
  getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPrice[]>;
  getDividends(symbol: string, from: string, to: string): Promise<DividendEvent[]>;
  getSplits(symbol: string, from: string, to: string): Promise<SplitEvent[]>;
};
