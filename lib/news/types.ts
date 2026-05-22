export type NewsProviderName = string;

export type NewsSignal = "positive" | "neutral" | "negative";

export type NewsArticle = {
  id: string;
  symbol: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  provider: NewsProviderName;
  publishedAt?: string;
  signal: NewsSignal;
  signalScore: number;
  matchedTerms: string[];
};

export type NewsDigest = {
  symbol: string;
  asOf: string;
  signal: NewsSignal;
  confidence: "low" | "medium" | "high";
  score: number;
  articleCount: number;
  providerCount: number;
  providers: NewsProviderName[];
  failedProviders: NewsProviderName[];
  publisherCount: number;
  publishers: string[];
  positiveArticleCount: number;
  negativeArticleCount: number;
  neutralArticleCount: number;
  headlines: string[];
  articles: NewsArticle[];
};
