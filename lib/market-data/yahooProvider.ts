import { addDays, format, parseISO } from "date-fns";
import type {
  DailyPrice,
  DividendEvent,
  MarketDataProvider,
  Quote,
  SplitEvent,
} from "@/lib/market-data/types";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        symbol?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
      events?: {
        dividends?: Record<string, { amount?: number; date?: number }>;
        splits?: Record<
          string,
          { date?: number; numerator?: number; denominator?: number; splitRatio?: string }
        >;
      };
    }>;
    error?: { description?: string };
  };
};

function toUnix(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

async function fetchYahooChart(symbol: string, params: URLSearchParams) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`,
    { next: { revalidate: 0 } },
  );
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed: ${response.status}`);
  }

  const data = (await response.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  if (!result || data.chart?.error) {
    throw new Error(data.chart?.error?.description || "Yahoo chart response was empty.");
  }
  return result;
}

export class YahooProvider implements MarketDataProvider {
  async getQuote(symbol: string): Promise<Quote> {
    const result = await fetchYahooChart(
      symbol,
      new URLSearchParams({
        range: "1d",
        interval: "1d",
      }),
    );
    const price = result.meta?.regularMarketPrice;
    if (!price || result.meta?.currency !== "USD") {
      throw new Error("Yahoo quote response did not include a USD price.");
    }

    return {
      symbol: (result.meta.symbol || symbol).toUpperCase(),
      price,
      currency: "USD",
      asOf: result.meta.regularMarketTime
        ? new Date(result.meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      provider: "yahoo",
      isDelayed: true,
      sourceNote: "Yahoo public quote fallback. May be delayed.",
    };
  }

  async getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPrice[]> {
    const result = await fetchYahooChart(
      symbol,
      new URLSearchParams({
        period1: String(toUnix(from)),
        period2: String(toUnix(format(addDays(parseISO(to), 1), "yyyy-MM-dd"))),
        interval: "1d",
        events: "history",
      }),
    );
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose || [];

    return timestamps.flatMap((timestamp, index) => {
      const close = quote?.close?.[index];
      if (!close) {
        return [];
      }
      return {
        symbol: symbol.toUpperCase(),
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: quote?.open?.[index] ?? close,
        high: quote?.high?.[index] ?? close,
        low: quote?.low?.[index] ?? close,
        close,
        adjustedClose: adjclose[index] ?? close,
        volume: quote?.volume?.[index] ?? 0,
        provider: "yahoo" as const,
      };
    });
  }

  async getDividends(symbol: string, from: string, to: string): Promise<DividendEvent[]> {
    const result = await fetchYahooChart(
      symbol,
      new URLSearchParams({
        period1: String(toUnix(from)),
        period2: String(toUnix(format(addDays(parseISO(to), 1), "yyyy-MM-dd"))),
        interval: "1d",
        events: "div",
      }),
    );

    return Object.values(result.events?.dividends || {}).flatMap((event) => {
      if (!event.date || typeof event.amount !== "number") {
        return [];
      }
      return {
        symbol: symbol.toUpperCase(),
        exDate: new Date(event.date * 1000).toISOString().slice(0, 10),
        amountPerShare: event.amount,
        currency: "USD" as const,
        provider: "yahoo" as const,
      };
    });
  }

  async getSplits(symbol: string, from: string, to: string): Promise<SplitEvent[]> {
    const result = await fetchYahooChart(
      symbol,
      new URLSearchParams({
        period1: String(toUnix(from)),
        period2: String(toUnix(format(addDays(parseISO(to), 1), "yyyy-MM-dd"))),
        interval: "1d",
        events: "split",
      }),
    );

    return Object.values(result.events?.splits || {}).flatMap((event) => {
      if (!event.date || !event.numerator || !event.denominator) {
        return [];
      }
      return {
        symbol: symbol.toUpperCase(),
        date: new Date(event.date * 1000).toISOString().slice(0, 10),
        fromFactor: event.denominator,
        toFactor: event.numerator,
        ratio: event.numerator / event.denominator,
        provider: "yahoo" as const,
      };
    });
  }
}
