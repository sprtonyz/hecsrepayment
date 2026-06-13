import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  codexReviewSchema,
  reviewMonthSchema,
  symbolSchema,
} from "@/lib/news/codexReviewSchemas";
import { writeLocalCodexReviewBundle } from "@/lib/news/codexReviewLocalStore";
import { getSharedNewsConfig } from "@/lib/shared-news/config";
import { upsertSharedCodexReview } from "@/lib/shared-news/store";

const bodySchema = z.object({
  symbol: symbolSchema,
  reviewMonth: reviewMonthSchema,
  filename: z.string().min(1).optional(),
  generatedAt: z.string().min(1).optional(),
  includedArticleCount: z.number().int().min(0).optional(),
  sourceUpdatedAt: z.string().min(1).optional(),
  codexReview: codexReviewSchema,
});

export async function POST(request: NextRequest) {
  const unauthorized = requireSharedReviewToken(request);
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid shared Codex review publish request." }, { status: 400 });
  }

  try {
    const localSaved = await writeLocalCodexReviewBundle({
      symbol: parsed.data.symbol,
      reviewMonth: parsed.data.reviewMonth,
      filename: parsed.data.filename,
      generatedAt: parsed.data.generatedAt,
      includedArticleCount: parsed.data.includedArticleCount,
      codexReview: parsed.data.codexReview,
    });

    try {
      const saved = await upsertSharedCodexReview(parsed.data);
      if (!saved.enabled) {
        return noStoreJson({
          saved: true,
          storedLocally: true,
          reviewMonth: parsed.data.reviewMonth,
          filename: localSaved.filename,
          generatedAt: parsed.data.generatedAt || localSaved.bundle.generatedAt,
          includedArticleCount: parsed.data.includedArticleCount,
          sourceUpdatedAt: parsed.data.sourceUpdatedAt,
          syncState: "local-only",
        });
      }

      return noStoreJson({
        saved: true,
        storedLocally: true,
        reviewMonth: saved.reviewMonth,
        filename: saved.filename || localSaved.filename,
        generatedAt: saved.generatedAt,
        includedArticleCount: saved.includedArticleCount,
        sourceUpdatedAt: saved.sourceUpdatedAt,
        syncState: "shared-and-local",
      });
    } catch (error) {
      return noStoreJson({
        saved: true,
        storedLocally: true,
        reviewMonth: parsed.data.reviewMonth,
        filename: localSaved.filename,
        generatedAt: parsed.data.generatedAt || localSaved.bundle.generatedAt,
        includedArticleCount: parsed.data.includedArticleCount,
        sourceUpdatedAt: parsed.data.sourceUpdatedAt,
        syncState: "local-only",
        syncError: error instanceof Error ? error.message : "Shared Codex review sync failed.",
      });
    }
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not publish the shared Codex review.",
      },
      { status: 500 },
    );
  }
}

function requireSharedReviewToken(request: NextRequest) {
  const token = getSharedNewsConfig().reviewToken;
  if (!token) {
    return null;
  }

  const providedToken =
    request.headers.get("x-review-token") || request.nextUrl.searchParams.get("token");
  if (providedToken === token) {
    return null;
  }

  return noStoreJson({ error: "Missing or invalid review token." }, { status: 401 });
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
