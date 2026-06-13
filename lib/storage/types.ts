export type Currency = "USD" | "AUD";
export type Ticker = string;
export type PriceMode = "live" | "dailyClose" | "manual";
export type MarketProviderName = "finnhub" | "alphaVantage" | "yahoo" | "manual";
export type NewsProviderName = string;
export type NewsSignal = "positive" | "neutral" | "negative";
export type AiArticleMateriality = "low" | "medium" | "high";
export type AiNewsAnalysisMode = "testing" | "performance";
export type AiArticleCategory =
  | "earnings"
  | "product"
  | "legalRegulatory"
  | "supplyChain"
  | "macroRatesFx"
  | "analystRating"
  | "competitivePosition"
  | "capitalReturn"
  | "valuationMarketAction"
  | "other";
export type AiArticleTimeHorizon = "shortTerm" | "mediumTerm" | "longTerm" | "unknown";
export type DividendMode = "cash" | "reinvested";

export type AppSettings = {
  id: "singleton";
  baseTicker: "AAPL" | Ticker;
  displayCurrency: Currency;
  baseValuationCurrency: "USD";
  contributionPlanCurrency: "AUD";
  planMonthlyContributionAud: number;
  planStartDate: string;
  planYears: number;
  includeDividends: boolean;
  dividendMode: DividendMode;
  includeSplits: boolean;
  defaultPriceMode: PriceMode;
  marketDataProvider: MarketProviderName;
  manualCurrentPriceUsd?: number;
  studyLoanEnabled: boolean;
  studyLoanBalanceAud: number;
  studyLoanPayoffAmountAud: number;
  studyLoanMonthlyRepaymentAud: number;
  studyLoanAnnualIncomeAud: number;
  studyLoanAnnualIndexationRatePercent: number;
  studyLoanUseIncomeFormula: boolean;
  studyLoanRedirectFreedRepayment: boolean;
  showMonthlyCodexReview: boolean;
  showReviewerCharter: boolean;
  isDemoMode?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SaleEvent = {
  id: string;
  ticker: Ticker;
  saleDate: string;
  sharesSold: number;
  salePricePerShareUsd: number;
  grossProceedsUsd: number;
  feesUsd: number;
  netProceedsUsd: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Contribution = {
  id: string;
  date: string;
  amount: number;
  currencyEntered: Currency;
  fxRateToUsd: number;
  amountUsd: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TradeSide = "BUY" | "SELL";

export type Trade = {
  id: string;
  date: string;
  ticker: Ticker;
  side: TradeSide;
  shares: number;
  pricePerShare: number;
  currencyEntered: Currency;
  fxRateToUsd: number;
  pricePerShareUsd: number;
  grossAmountUsd: number;
  feesUsd: number;
  feeCurrency?: Currency;
  totalAmountUsd: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CachedQuote = {
  symbol: Ticker;
  priceUsd: number;
  asOf: string;
  provider: MarketProviderName;
  isDelayed?: boolean;
  sourceNote?: string;
  raw?: unknown;
};

export type CachedDailyPrice = {
  symbol: Ticker;
  date: string;
  closeUsd: number;
  adjustedCloseUsd?: number;
  provider: MarketProviderName;
  raw?: unknown;
};

export type CachedDividend = {
  symbol: Ticker;
  exDate: string;
  payDate?: string;
  amountPerShareUsd: number;
  provider: MarketProviderName;
  raw?: unknown;
};

export type CachedSplit = {
  symbol: Ticker;
  date: string;
  ratio: number;
  fromFactor: number;
  toFactor: number;
  provider: MarketProviderName;
  raw?: unknown;
};

export type CachedFxRate = {
  id: string;
  base: Currency;
  quote: Currency;
  date: string;
  rate: number;
  asOf: string;
  provider: "frankfurter" | "manual";
  raw?: unknown;
};

export type CachedNewsArticle = {
  id: string;
  symbol: Ticker;
  title: string;
  summary?: string;
  url: string;
  source: string;
  provider: NewsProviderName;
  publishedAt?: string;
  collectedAt?: string;
  cachedAt?: string;
  lastFetchedAt?: string;
  signal: NewsSignal;
  signalScore: number;
  matchedTerms: string[];
  raw?: unknown;
};

export type CachedNewsAnalysis = {
  id: string;
  articleId: string;
  symbol: Ticker;
  url: string;
  title: string;
  source: string;
  publishedAt?: string;
  analyzedAt: string;
  analysisMode: AiNewsAnalysisMode;
  primaryModel: string;
  finalModel: string;
  escalatedModel?: string;
  articleTextStatus: "read" | "summaryOnly" | "unavailable";
  signal: NewsSignal;
  confidence: "low" | "medium" | "high";
  materiality: AiArticleMateriality;
  thesisImpactScore: number;
  category: AiArticleCategory;
  timeHorizon: AiArticleTimeHorizon;
  rationale: string;
  evidence: string[];
  riskFlags: string[];
  opportunities: string[];
  shouldEscalate: boolean;
  escalationReason: string;
  raw?: unknown;
};

export type TrackerSnapshot = {
  settings?: AppSettings;
  saleEvents: SaleEvent[];
  contributions: Contribution[];
  trades: Trade[];
  quotes: CachedQuote[];
  dailyPrices: CachedDailyPrice[];
  dividends: CachedDividend[];
  splits: CachedSplit[];
  fxRates: CachedFxRate[];
  newsArticles: CachedNewsArticle[];
  newsAnalyses: CachedNewsAnalysis[];
};

export type StorageAdapter = {
  getSnapshot(): Promise<TrackerSnapshot>;
  saveSettings(settings: AppSettings): Promise<void>;
  saveSaleEvent(saleEvent: SaleEvent): Promise<void>;
  deleteSaleEvent(id: string): Promise<void>;
  saveContribution(contribution: Contribution): Promise<void>;
  deleteContribution(id: string): Promise<void>;
  saveTrade(trade: Trade): Promise<void>;
  deleteTrade(id: string): Promise<void>;
  saveQuote(quote: CachedQuote): Promise<void>;
  saveDailyPrices(prices: CachedDailyPrice[]): Promise<void>;
  saveDividends(dividends: CachedDividend[]): Promise<void>;
  saveSplits(splits: CachedSplit[]): Promise<void>;
  saveFxRate(rate: CachedFxRate): Promise<void>;
  saveNewsArticles(articles: CachedNewsArticle[]): Promise<void>;
  saveNewsAnalyses(analyses: CachedNewsAnalysis[]): Promise<void>;
  deleteMarketDataForSymbol(symbol: Ticker): Promise<{
    quotesDeleted: number;
    pricesDeleted: number;
    dividendsDeleted: number;
    splitsDeleted: number;
  }>;
  deleteNewsForSymbol(symbol: Ticker): Promise<{
    articlesDeleted: number;
    analysesDeleted: number;
  }>;
  importSnapshot(snapshot: TrackerSnapshot): Promise<void>;
  reset(): Promise<void>;
};
