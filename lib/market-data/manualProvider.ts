import { addDays, eachMonthOfInterval, format, parseISO } from "date-fns";
import type {
  DailyPrice,
  DividendEvent,
  MarketDataProvider,
  Quote,
  SplitEvent,
} from "@/lib/market-data/types";

const MANUAL_PRICE_USD = 205.5;

export class ManualProvider implements MarketDataProvider {
  async getQuote(symbol: string): Promise<Quote> {
    return {
      symbol: symbol.toUpperCase(),
      price: MANUAL_PRICE_USD,
      currency: "USD",
      asOf: new Date().toISOString(),
      provider: "manual",
      isDelayed: true,
      sourceNote: "Manual demo fallback. Set FINNHUB_API_KEY for live provider data.",
    };
  }

  async getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPrice[]> {
    const months = eachMonthOfInterval({
      start: parseISO(from),
      end: parseISO(to),
    }).slice(-36);

    return months.map((date, index) => {
      const close = Number((150 + index * 2.1 + Math.sin(index / 2) * 6).toFixed(2));
      return {
        symbol: symbol.toUpperCase(),
        date: format(addDays(date, 14), "yyyy-MM-dd"),
        open: close - 1.2,
        high: close + 2.3,
        low: close - 3.1,
        close,
        adjustedClose: close,
        volume: 0,
        provider: "manual",
      };
    });
  }

  async getDividends(symbol: string, from: string, to: string): Promise<DividendEvent[]> {
    const events = [
      { exDate: "2019-08-09", amountPerShare: 0.77 },
      { exDate: "2019-11-07", amountPerShare: 0.77 },
      { exDate: "2020-02-07", amountPerShare: 0.77 },
      { exDate: "2020-05-08", amountPerShare: 0.82 },
      { exDate: "2020-08-07", amountPerShare: 0.82 },
      { exDate: "2020-11-06", amountPerShare: 0.205 },
      { exDate: "2021-02-05", amountPerShare: 0.205 },
      { exDate: "2021-05-07", amountPerShare: 0.22 },
      { exDate: "2021-08-06", amountPerShare: 0.22 },
      { exDate: "2022-02-04", amountPerShare: 0.22 },
      { exDate: "2022-08-05", amountPerShare: 0.23 },
      { exDate: "2023-02-10", amountPerShare: 0.23 },
      { exDate: "2023-08-11", amountPerShare: 0.24 },
      { exDate: "2024-02-09", amountPerShare: 0.24 },
      { exDate: "2024-08-12", amountPerShare: 0.25 },
      { exDate: "2025-02-10", amountPerShare: 0.25 },
      { exDate: "2025-08-11", amountPerShare: 0.26 },
    ];

    return events
      .filter((event) => event.exDate >= from && event.exDate <= to)
      .map((event) => ({
        symbol: symbol.toUpperCase(),
        exDate: event.exDate,
        amountPerShare: event.amountPerShare,
        currency: "USD",
        provider: "manual",
      }));
  }

  async getSplits(symbol: string, from: string, to: string): Promise<SplitEvent[]> {
    const events = [
      {
        symbol: symbol.toUpperCase(),
        date: "2020-08-31",
        fromFactor: 1,
        toFactor: 4,
        ratio: 4,
        provider: "manual" as const,
      },
    ];
    return events.filter((event) => event.date >= from && event.date <= to);
  }
}
