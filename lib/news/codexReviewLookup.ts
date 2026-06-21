import { readFile } from "node:fs/promises";
import path from "node:path";
import { reviewBundleFilename } from "@/lib/news/codexReviewBundleBuilder";
import { codexReviewSchema } from "@/lib/news/codexReviewSchemas";
import { scoreCodexReviewForComparison } from "@/lib/news/codexReviewRanking";
import { getSharedCodexReview } from "@/lib/shared-news/store";

export type ComparisonReviewSeed = {
  symbol: string;
  reviewMonth: string;
  status: "loaded" | "prepared" | "missing" | "error";
  generatedAt?: string;
  filename?: string;
  rankScore: number;
  codexReview?: {
    appliedNewsDigest?: {
      signal?: "positive" | "neutral" | "negative";
      confidence?: "low" | "medium" | "high";
      positiveArticleCount?: number;
      negativeArticleCount?: number;
      neutralArticleCount?: number;
      materialArticleCount?: number;
    };
    suggestedGuideImpact?: {
      rationale?: string;
      expectedAdjustmentPercent?: number;
      depositSuggestion?: string;
      newsSignal?: string;
    };
    rationale?: string;
  };
  error?: string;
};

export async function loadComparisonReviewSeeds(
  symbols: readonly string[],
  reviewMonth: string,
): Promise<ComparisonReviewSeed[]> {
  return Promise.all(
    symbols.map(async (symbol) => {
      try {
        const sharedReview = await getSharedCodexReview(symbol, reviewMonth).catch(() => undefined);
        if (sharedReview?.codexReview) {
          const parsed = codexReviewSchema.safeParse(sharedReview.codexReview);
          if (parsed.success) {
            return {
              symbol,
              reviewMonth,
              status: "loaded" as const,
              generatedAt: sharedReview.generatedAt,
              filename: sharedReview.filename,
              codexReview: parsed.data,
              rankScore: scoreCodexReviewForComparison(parsed.data),
            };
          }
        }

        const absolutePath = path.join(
          process.cwd(),
          "data",
          "news-review-queue",
          reviewBundleFilename(symbol, reviewMonth),
        );
        const raw = await readFile(absolutePath, "utf8");
        const bundle = JSON.parse(raw) as Record<string, unknown>;
        const parsed = codexReviewSchema.safeParse(bundle.codexReview);
        if (parsed.success) {
          return {
            symbol,
            reviewMonth,
            status: "loaded" as const,
            generatedAt: typeof bundle.generatedAt === "string" ? bundle.generatedAt : undefined,
            filename: reviewBundleFilename(symbol, reviewMonth),
            codexReview: parsed.data,
            rankScore: scoreCodexReviewForComparison(parsed.data),
          };
        }

        return {
          symbol,
          reviewMonth,
          status: "prepared" as const,
          filename: reviewBundleFilename(symbol, reviewMonth),
          rankScore: 0,
        };
      } catch (error) {
        return {
          symbol,
          reviewMonth,
          status: "missing" as const,
          rankScore: -999,
          error: error instanceof Error ? error.message : "Could not load review.",
        };
      }
    }),
  );
}
