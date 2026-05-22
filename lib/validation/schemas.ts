import { z } from "zod";
import { todayIso } from "@/lib/domain/dates";

export const currencySchema = z.enum(["USD", "AUD"]);

const positiveNumber = z.coerce.number().finite().positive();
const nonNegativeNumber = z.coerce.number().finite().min(0);

export const saleEventSchema = z
  .object({
    ticker: z.string().min(1).default("AAPL"),
    saleDate: z.string().refine((date) => date <= todayIso(), {
      message: "Sale date must be today or earlier.",
    }),
    sharesSold: positiveNumber,
    salePricePerShareUsd: positiveNumber,
    grossProceedsUsd: positiveNumber,
    feesUsd: nonNegativeNumber.default(0),
    netProceedsUsd: nonNegativeNumber,
    notes: z.string().optional(),
  })
  .refine((value) => value.netProceedsUsd <= value.grossProceedsUsd, {
    path: ["netProceedsUsd"],
    message: "Net proceeds cannot exceed gross proceeds.",
  });

export const contributionSchema = z.object({
  date: z.string(),
  amount: positiveNumber,
  currencyEntered: currencySchema,
  fxRateToUsd: positiveNumber,
  amountUsd: positiveNumber,
  notes: z.string().optional(),
});

export const tradeSchema = z.object({
  date: z.string(),
  ticker: z.string().min(1).default("AAPL"),
  side: z.enum(["BUY", "SELL"]),
  shares: positiveNumber,
  pricePerShare: positiveNumber,
  currencyEntered: currencySchema,
  fxRateToUsd: positiveNumber,
  pricePerShareUsd: positiveNumber,
  grossAmountUsd: positiveNumber,
  feesUsd: nonNegativeNumber.default(0),
  totalAmountUsd: positiveNumber,
  notes: z.string().optional(),
});

export const settingsSchema = z.object({
  baseTicker: z.string().min(1).default("AAPL"),
  displayCurrency: currencySchema.default("USD"),
  baseValuationCurrency: z.literal("USD").default("USD"),
  contributionPlanCurrency: z.literal("AUD").default("AUD"),
  planMonthlyContributionAud: positiveNumber.default(600),
  planStartDate: z.string(),
  planYears: z.coerce.number().finite().min(1).max(30).default(5),
  includeDividends: z.boolean().default(true),
  dividendMode: z.enum(["cash", "reinvested"]).default("cash"),
  includeSplits: z.boolean().default(true),
  defaultPriceMode: z.enum(["live", "dailyClose", "manual"]).default("live"),
  marketDataProvider: z.enum(["finnhub", "alphaVantage", "yahoo", "manual"]).default("finnhub"),
  manualCurrentPriceUsd: nonNegativeNumber.optional(),
  studyLoanEnabled: z.boolean().default(true),
  studyLoanBalanceAud: nonNegativeNumber.default(36000),
  studyLoanPayoffAmountAud: nonNegativeNumber.default(36000),
  studyLoanMonthlyRepaymentAud: nonNegativeNumber.default(594),
  studyLoanAnnualIncomeAud: nonNegativeNumber.default(120000),
  studyLoanAnnualIndexationRatePercent: z.coerce.number().finite().min(0).max(30).default(3.2),
  studyLoanUseIncomeFormula: z.boolean().default(false),
  studyLoanRedirectFreedRepayment: z.boolean().default(true),
});

export const projectionAssumptionsSchema = z.object({
  monthlyContributionAud: positiveNumber,
  audUsdRate: positiveNumber,
  annualGrowthRatePercent: z.coerce.number().finite().min(-95).max(200),
  annualDividendYieldPercent: z.coerce.number().finite().min(0).max(20),
  months: z.coerce.number().int().min(1).max(600),
});
