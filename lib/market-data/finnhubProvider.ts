import type {
  DailyPrice,
  DividendEvent,
  MarketDataProvider,
  Quote,
  SplitEvent,
} from "@/lib/market-data/types";

function toUnix(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

async function fetchFinnhub<T>(path: string, apiKey: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://finnhub.io/api/v1/${path}${separator}token=${apiKey}`, {
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Finnhub request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export class FinnhubProvider implements MarketDataProvider {
  constructor(private readonly apiKey: string) {}

  async getQuote(symbol: string): Promise<Quote> {
    const data = await fetchFinnhub<{ c?: number; t?: number }>(
      `quote?symbol=${encodeURIComponent(symbol)}`,
      this.apiKey,
    );
    if (!data.c) {
      throw new Error("Finnhub quote response did not include a current price.");
    }
    return {
      symbol: symbol.toUpperCase(),
      price: data.c,
      currency: "USD",
      asOf: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
      provider: "finnhub",
      isDelayed: false,
    };
  }

  async getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPrice[]> {
    const data = await fetchFinnhub<{
      s: string;
      t?: number[];
      o?: number[];
      h?: number[];
      l?: number[];
      c?: number[];
      v?: number[];
    }>(
      `stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${toUnix(from)}&to=${toUnix(to)}`,
      this.apiKey,
    );

    if (data.s !== "ok" || !data.t) {
      return [];
    }

    return data.t.map((timestamp, index) => ({
      symbol: symbol.toUpperCase(),
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: data.o?.[index] ?? 0,
      high: data.h?.[index] ?? 0,
      low: data.l?.[index] ?? 0,
      close: data.c?.[index] ?? 0,
      adjustedClose: data.c?.[index] ?? 0,
      volume: data.v?.[index] ?? 0,
      provider: "finnhub",
    }));
  }

  async getDividends(symbol: string, from: string, to: string): Promise<DividendEvent[]> {
    const data = await fetchFinnhub<
      Array<{ symbol?: string; exDate?: string; paymentDate?: string; amount?: number }>
    >(
      `stock/dividend?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
      this.apiKey,
    );

    return data
      .filter((item) => item.exDate && typeof item.amount === "number")
      .map((item) => ({
        symbol: (item.symbol || symbol).toUpperCase(),
        exDate: item.exDate!,
        payDate: item.paymentDate,
        amountPerShare: item.amount!,
        currency: "USD",
        provider: "finnhub",
      }));
  }

  async getSplits(symbol: string, from: string, to: string): Promise<SplitEvent[]> {
    const data = await fetchFinnhub<
      Array<{ symbol?: string; date?: string; fromFactor?: number; toFactor?: number }>
    >(
      `stock/split?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
      this.apiKey,
    );

    return data
      .filter((item) => item.date && item.fromFactor && item.toFactor)
      .map((item) => ({
        symbol: (item.symbol || symbol).toUpperCase(),
        date: item.date!,
        fromFactor: item.fromFactor!,
        toFactor: item.toFactor!,
        ratio: item.toFactor! / item.fromFactor!,
        provider: "finnhub",
      }));
  }
}
