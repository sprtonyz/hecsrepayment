"use client";

import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  CachedDailyPrice,
  CachedDividend,
  CachedFxRate,
  CachedNewsAnalysis,
  CachedNewsArticle,
  CachedQuote,
  CachedSplit,
  Contribution,
  SaleEvent,
  StorageAdapter,
  TrackerSnapshot,
  Trade,
} from "@/lib/storage/types";

class CatchUpTrackerDb extends Dexie {
  settings!: Table<AppSettings, string>;
  saleEvents!: Table<SaleEvent, string>;
  contributions!: Table<Contribution, string>;
  trades!: Table<Trade, string>;
  quotes!: Table<CachedQuote, string>;
  dailyPrices!: Table<CachedDailyPrice, [string, string]>;
  dividends!: Table<CachedDividend, [string, string]>;
  splits!: Table<CachedSplit, [string, string]>;
  fxRates!: Table<CachedFxRate, string>;
  newsArticles!: Table<CachedNewsArticle, string>;
  newsAnalyses!: Table<CachedNewsAnalysis, string>;

  constructor() {
    super("aaplCatchUpTracker");
    this.version(1).stores({
      settings: "id",
      saleEvents: "id,ticker,saleDate",
      contributions: "id,date,currencyEntered",
      trades: "id,date,ticker,side",
      quotes: "symbol,asOf,provider",
      dailyPrices: "[symbol+date],symbol,date",
      dividends: "[symbol+exDate],symbol,exDate",
      splits: "[symbol+date],symbol,date",
      fxRates: "id,[base+quote+date],base,quote,date",
    });
    this.version(2).stores({
      settings: "id",
      saleEvents: "id,ticker,saleDate",
      contributions: "id,date,currencyEntered",
      trades: "id,date,ticker,side",
      quotes: "symbol,asOf,provider",
      dailyPrices: "[symbol+date],symbol,date",
      dividends: "[symbol+exDate],symbol,exDate",
      splits: "[symbol+date],symbol,date",
      fxRates: "id,[base+quote+date],base,quote,date",
      newsArticles: "id,symbol,publishedAt,provider,source",
    });
    this.version(3).stores({
      settings: "id",
      saleEvents: "id,ticker,saleDate",
      contributions: "id,date,currencyEntered",
      trades: "id,date,ticker,side",
      quotes: "symbol,asOf,provider",
      dailyPrices: "[symbol+date],symbol,date",
      dividends: "[symbol+exDate],symbol,exDate",
      splits: "[symbol+date],symbol,date",
      fxRates: "id,[base+quote+date],base,quote,date",
      newsArticles: "id,symbol,publishedAt,provider,source",
      newsAnalyses: "id,articleId,symbol,analysisMode,analyzedAt,finalModel,materiality,signal,confidence",
    });
  }
}

const db = new CatchUpTrackerDb();

export const indexedDbAdapter: StorageAdapter = {
  async getSnapshot(): Promise<TrackerSnapshot> {
    const [
      settings,
      saleEvents,
      contributions,
      trades,
      quotes,
      dailyPrices,
      dividends,
      splits,
      fxRates,
      newsArticles,
      newsAnalyses,
    ] =
      await Promise.all([
        db.settings.get("singleton"),
        db.saleEvents.toArray(),
        db.contributions.orderBy("date").toArray(),
        db.trades.orderBy("date").toArray(),
        db.quotes.toArray(),
        db.dailyPrices.toArray(),
        db.dividends.toArray(),
        db.splits.toArray(),
        db.fxRates.toArray(),
        db.newsArticles.toArray(),
        db.newsAnalyses.toArray(),
      ]);

    return {
      settings,
      saleEvents,
      contributions,
      trades,
      quotes,
      dailyPrices,
      dividends,
      splits,
      fxRates,
      newsArticles,
      newsAnalyses,
    };
  },

  async saveSettings(settings) {
    await db.settings.put(settings);
  },

  async saveSaleEvent(saleEvent) {
    await db.saleEvents.put(saleEvent);
  },

  async deleteSaleEvent(id) {
    await db.saleEvents.delete(id);
  },

  async saveContribution(contribution) {
    await db.contributions.put(contribution);
  },

  async deleteContribution(id) {
    await db.contributions.delete(id);
  },

  async saveTrade(trade) {
    await db.trades.put(trade);
  },

  async deleteTrade(id) {
    await db.trades.delete(id);
  },

  async saveQuote(quote) {
    await db.quotes.put(quote);
  },

  async saveDailyPrices(prices) {
    await db.dailyPrices.bulkPut(prices);
  },

  async saveDividends(dividends) {
    await db.dividends.bulkPut(dividends);
  },

  async saveSplits(splits) {
    await db.splits.bulkPut(splits);
  },

  async saveFxRate(rate) {
    await db.fxRates.put(rate);
  },

  async saveNewsArticles(articles) {
    await db.newsArticles.bulkPut(articles);
  },

  async saveNewsAnalyses(analyses) {
    await db.newsAnalyses.bulkPut(analyses);
  },

  async deleteMarketDataForSymbol(symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    let quotesDeleted = 0;
    let pricesDeleted = 0;
    let dividendsDeleted = 0;
    let splitsDeleted = 0;

    await db.transaction(
      "rw",
      [db.quotes, db.dailyPrices, db.dividends, db.splits],
      async () => {
        quotesDeleted = await db.quotes.where("symbol").equals(normalizedSymbol).delete();
        pricesDeleted = await db.dailyPrices.where("symbol").equals(normalizedSymbol).delete();
        dividendsDeleted = await db.dividends.where("symbol").equals(normalizedSymbol).delete();
        splitsDeleted = await db.splits.where("symbol").equals(normalizedSymbol).delete();
      },
    );

    return {
      quotesDeleted,
      pricesDeleted,
      dividendsDeleted,
      splitsDeleted,
    };
  },

  async deleteNewsForSymbol(symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    let articlesDeleted = 0;
    let analysesDeleted = 0;

    await db.transaction("rw", [db.newsArticles, db.newsAnalyses], async () => {
      articlesDeleted = await db.newsArticles.where("symbol").equals(normalizedSymbol).delete();
      analysesDeleted = await db.newsAnalyses.where("symbol").equals(normalizedSymbol).delete();
    });

    return {
      articlesDeleted,
      analysesDeleted,
    };
  },

  async importSnapshot(snapshot) {
    await db.transaction(
      "rw",
      [
        db.settings,
        db.saleEvents,
        db.contributions,
        db.trades,
        db.quotes,
        db.dailyPrices,
        db.dividends,
        db.splits,
        db.fxRates,
        db.newsArticles,
        db.newsAnalyses,
      ],
      async () => {
        await Promise.all([
          db.settings.clear(),
          db.saleEvents.clear(),
          db.contributions.clear(),
          db.trades.clear(),
          db.quotes.clear(),
          db.dailyPrices.clear(),
          db.dividends.clear(),
          db.splits.clear(),
          db.fxRates.clear(),
          db.newsArticles.clear(),
          db.newsAnalyses.clear(),
        ]);
        if (snapshot.settings) {
          await db.settings.put(snapshot.settings);
        }
        await Promise.all([
          db.saleEvents.bulkPut(snapshot.saleEvents || []),
          db.contributions.bulkPut(snapshot.contributions || []),
          db.trades.bulkPut(snapshot.trades || []),
          db.quotes.bulkPut(snapshot.quotes || []),
          db.dailyPrices.bulkPut(snapshot.dailyPrices || []),
          db.dividends.bulkPut(snapshot.dividends || []),
          db.splits.bulkPut(snapshot.splits || []),
          db.fxRates.bulkPut(snapshot.fxRates || []),
          db.newsArticles.bulkPut(snapshot.newsArticles || []),
          db.newsAnalyses.bulkPut(snapshot.newsAnalyses || []),
        ]);
      },
    );
  },

  async reset() {
    await db.delete();
    await db.open();
  },
};
