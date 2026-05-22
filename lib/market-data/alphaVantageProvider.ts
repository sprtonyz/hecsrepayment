import type {
  DailyPrice,
  DividendEvent,
  MarketDataProvider,
  Quote,
  SplitEvent,
} from "@/lib/market-data/types";

async function fetchAlphaVantage<T>(params: Record<string, string>, apiKey: string): Promise<T> {
  const search = new URLSearchParams({ ...params, apikey: apiKey });
  const response = await fetch(`https://www.alphavantage.co/query?${search.toString()}`, {
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export class AlphaVantageProvider implements MarketDataProvider {
  constructor(private readonly apiKey: string) {}

  async getQuote(symbol: string): Promise<Quote> {
    const data = await fetchAlphaVantage<Record<string, Record<string, string>>>(
      { function: "GLOBAL_QUOTE", symbol },
      this.apiKey,
    );
    const quote = data["Global Quote"];
    const price = Number(quote?.["05. price"]);
    if (!price) {
      throw new Error("Alpha Vantage quote response did not include a price.");
    }
    return {
      symbol: symbol.toUpperCase(),
      price,
      currency: "USD",
      asOf: new Date().toISOString(),
      provider: "alphaVantage",
      isDelayed: true,
      sourceNote: "Alpha Vantage global quote endpoint may be delayed.",
    };
  }

  async getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPrice[]> {
    const data = await fetchAlphaVantage<{
      "Time Series (Daily)"?: Record<string, Record<string, string>>;
    }>(
      { function: "TIME_SERIES_DAILY_ADJUSTED", symbol, outputsize: "full" },
      this.apiKey,
    );
    const series = data["Time Series (Daily)"] || {};
    return Object.entries(series)
      .filter(([date]) => date >= from && date <= to)
      .map(([date, point]) => ({
        symbol: symbol.toUpperCase(),
        date,
        open: Number(point["1. open"]),
        high: Number(point["2. high"]),
        low: Number(point["3. low"]),
        close: Number(point["4. close"]),
        adjustedClose: Number(point["5. adjusted close"]),
        volume: Number(point["6. volume"]),
        provider: "alphaVantage" as const,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getDividends(): Promise<DividendEvent[]> {
    return [];
  }

  async getSplits(): Promise<SplitEvent[]> {
    return [];
  }
}
