import { z } from "zod";

export const symbolSchema = z.string().min(1).max(12).regex(/^[a-z0-9.-]+$/i);

export const reviewMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const appliedNewsDigestSchema = z.object({
  signal: z.enum(["positive", "neutral", "negative"]),
  confidence: z.enum(["low", "medium", "high"]),
  articleCount: z.number(),
  providerCount: z.number(),
  providers: z.array(z.string()),
  failedProviders: z.array(z.string()).optional(),
  publisherCount: z.number().optional(),
  publishers: z.array(z.string()).optional(),
  score: z.number().optional(),
  headlines: z.array(z.string()).optional(),
  positiveArticleCount: z.number().optional(),
  negativeArticleCount: z.number().optional(),
  neutralArticleCount: z.number().optional(),
  materialArticleCount: z.number().optional(),
  highMaterialityCount: z.number().optional(),
  escalatedCount: z.number().optional(),
  analysisMode: z.literal("codexReview"),
});

export const codexReviewSchema = z.object({
  appliedNewsDigest: appliedNewsDigestSchema,
}).passthrough();
