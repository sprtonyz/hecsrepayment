import { AlphaVantageProvider } from "@/lib/market-data/alphaVantageProvider";
import { FinnhubProvider } from "@/lib/market-data/finnhubProvider";
import { ManualProvider } from "@/lib/market-data/manualProvider";
import { YahooProvider } from "@/lib/market-data/yahooProvider";
import type { MarketDataProvider } from "@/lib/market-data/types";
import type { MarketProviderName } from "@/lib/storage/types";

export function createMarketDataProvider(preferred?: MarketProviderName): MarketDataProvider {
  if (preferred === "manual") {
    return new ManualProvider();
  }

  if ((preferred === "finnhub" || !preferred) && process.env.FINNHUB_API_KEY) {
    return new FinnhubProvider(process.env.FINNHUB_API_KEY);
  }

  if (preferred === "alphaVantage" && process.env.ALPHA_VANTAGE_API_KEY) {
    return new AlphaVantageProvider(process.env.ALPHA_VANTAGE_API_KEY);
  }

  return new YahooProvider();
}

export function activeProviderName(preferred?: MarketProviderName): MarketProviderName {
  if ((preferred === "finnhub" || !preferred) && process.env.FINNHUB_API_KEY) {
    return "finnhub";
  }
  if (preferred === "alphaVantage" && process.env.ALPHA_VANTAGE_API_KEY) {
    return "alphaVantage";
  }
  if (preferred === "manual") {
    return "manual";
  }
  return "yahoo";
}
