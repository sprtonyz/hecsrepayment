import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCodexReviewBundle,
  reviewBundleFilename,
} from "@/lib/news/codexReviewBundleBuilder";

const symbolSchema = z.string().min(1).max(12).regex(/^[a-z0-9.-]+$/i);
const reviewMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const newsArticleSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  url: z.string().url(),
  source: z.string().min(1),
  provider: z.string().min(1).max(64),
  publishedAt: z.string().optional(),
  collectedAt: z.string().optional(),
  cachedAt: z.string().optional(),
  lastFetchedAt: z.string().optional(),
  signal: z.enum(["positive", "neutral", "negative"]),
  signalScore: z.number(),
  matchedTerms: z.array(z.string()),
});

const newsAnalysisSchema = z.object({
  articleId: z.string(),
  analyzedAt: z.string(),
  analysisMode: z.enum(["testing", "performance"]),
  finalModel: z.string(),
  escalatedModel: z.string().optional(),
  signal: z.enum(["positive", "neutral", "negative"]),
  confidence: z.enum(["low", "medium", "high"]),
  materiality: z.enum(["low", "medium", "high"]),
  thesisImpactScore: z.number(),
  category: z.string(),
  timeHorizon: z.string(),
  rationale: z.string(),
  evidence: z.array(z.string()),
  riskFlags: z.array(z.string()),
  opportunities: z.array(z.string()),
});

const bodySchema = z.object({
  symbol: symbolSchema,
  reviewMonth: reviewMonthSchema,
  articles: z.array(newsArticleSchema),
  analyses: z.array(newsAnalysisSchema).default([]),
  guideContext: z.record(z.string(), z.unknown()).optional(),
});

const appliedNewsDigestSchema = z.object({
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

const codexReviewSchema = z.object({
  appliedNewsDigest: appliedNewsDigestSchema,
}).passthrough();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = z.object({
    symbol: symbolSchema,
    reviewMonth: reviewMonthSchema,
  }).safeParse({
    symbol: searchParams.get("symbol"),
    reviewMonth: searchParams.get("reviewMonth"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Codex review lookup." }, { status: 400 });
  }

  const { absolutePath, filename } = reviewBundlePath(
    parsed.data.symbol,
    parsed.data.reviewMonth,
  );
  const bundle = await readReviewBundle(absolutePath);
  if (!bundle) {
    return noStoreJson({
      filename,
      codexReview: null,
    });
  }

  const codexReview = codexReviewSchema.safeParse(bundle.codexReview);
  return noStoreJson({
    filename,
    generatedAt: typeof bundle.generatedAt === "string" ? bundle.generatedAt : undefined,
    includedArticleCount:
      typeof bundle.includedArticleCount === "number" ? bundle.includedArticleCount : undefined,
    codexReview: codexReview.success ? codexReview.data : null,
  });
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Codex review bundle request." }, { status: 400 });
  }

  const { symbol, reviewMonth, guideContext } = parsed.data;
  const { absolutePath, filename } = reviewBundlePath(symbol, reviewMonth);
  const existingCodexReview = await readExistingCodexReview(absolutePath);
  const result = await buildCodexReviewBundle({
    symbol,
    reviewMonth,
    articles: parsed.data.articles,
    analyses: parsed.data.analyses,
    guideContext,
    existingCodexReview,
  });

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(result.bundle, null, 2)}\n`, "utf8");

  return NextResponse.json({
    path: absolutePath,
    filename,
    includedArticleCount: result.includedArticleCount,
    reviewBrief: {
      duplicateGroupCount: result.reviewBrief.coverage.duplicateGroupCount,
      likelyNoiseArticleCount: result.reviewBrief.coverage.likelyNoiseArticleCount,
      articleTextStatusCounts: result.reviewBrief.coverage.articleTextStatusCounts,
    },
    generatedAt: result.generatedAt,
  });
}

function reviewBundlePath(symbol: string, reviewMonth: string) {
  const directory = path.join(process.cwd(), "data", "news-review-queue");
  const filename = reviewBundleFilename(symbol, reviewMonth);
  return {
    directory,
    filename,
    absolutePath: path.join(directory, filename),
  };
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "cache-control": "no-store",
    },
  });
}

async function readExistingCodexReview(absolutePath: string) {
  const bundle = await readReviewBundle(absolutePath);
  if (!bundle) {
    return undefined;
  }
  const codexReview = codexReviewSchema.safeParse(bundle.codexReview);
  return codexReview.success ? codexReview.data : undefined;
}

async function readReviewBundle(absolutePath: string) {
  try {
    return JSON.parse(await readFile(absolutePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
