import type {
  AppSettings,
  CachedDividend,
  CachedSplit,
  Contribution,
  SaleEvent,
  Trade,
} from "@/lib/storage/types";

export const settingsFixture: AppSettings = {
  id: "singleton",
  baseTicker: "AAPL",
  displayCurrency: "USD",
  baseValuationCurrency: "USD",
  contributionPlanCurrency: "AUD",
  planMonthlyContributionAud: 600,
  planStartDate: "2026-01-10",
  planYears: 5,
  includeDividends: true,
  dividendMode: "cash",
  includeSplits: true,
  defaultPriceMode: "manual",
  marketDataProvider: "manual",
  manualCurrentPriceUsd: 100,
  studyLoanEnabled: true,
  studyLoanBalanceAud: 36000,
  studyLoanPayoffAmountAud: 36000,
  studyLoanMonthlyRepaymentAud: 594,
  studyLoanAnnualIncomeAud: 120000,
  studyLoanAnnualIndexationRatePercent: 3.2,
  studyLoanUseIncomeFormula: false,
  studyLoanRedirectFreedRepayment: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const saleFixture: SaleEvent = {
  id: "sale-1",
  ticker: "AAPL",
  saleDate: "2020-01-01",
  sharesSold: 10,
  salePricePerShareUsd: 100,
  grossProceedsUsd: 1000,
  feesUsd: 0,
  netProceedsUsd: 1000,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
};

export const splitFixture: CachedSplit[] = [
  {
    symbol: "AAPL",
    date: "2020-08-31",
    fromFactor: 1,
    toFactor: 4,
    ratio: 4,
    provider: "manual",
  },
];

export const dividendFixture: CachedDividend[] = [
  {
    symbol: "AAPL",
    exDate: "2020-02-01",
    amountPerShareUsd: 1,
    provider: "manual",
  },
  {
    symbol: "AAPL",
    exDate: "2021-02-01",
    amountPerShareUsd: 0.25,
    provider: "manual",
  },
];

export const contributionFixture: Contribution[] = [
  {
    id: "contribution-1",
    date: "2020-02-01",
    amount: 600,
    currencyEntered: "AUD",
    fxRateToUsd: 0.65,
    amountUsd: 390,
    createdAt: "2020-02-01T00:00:00.000Z",
    updatedAt: "2020-02-01T00:00:00.000Z",
  },
];

export const tradeFixture: Trade[] = [
  {
    id: "trade-1",
    date: "2020-02-01",
    ticker: "AAPL",
    side: "BUY",
    shares: 2,
    pricePerShare: 50,
    currencyEntered: "USD",
    fxRateToUsd: 1,
    pricePerShareUsd: 50,
    grossAmountUsd: 100,
    feesUsd: 0,
    totalAmountUsd: 100,
    createdAt: "2020-02-01T00:00:00.000Z",
    updatedAt: "2020-02-01T00:00:00.000Z",
  },
];
