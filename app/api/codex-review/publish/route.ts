import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  codexReviewSchema,
  reviewMonthSchema,
  symbolSchema,
} from "@/lib/news/codexReviewSchemas";
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
    const saved = await upsertSharedCodexReview(parsed.data);
    if (!saved.enabled) {
      return noStoreJson(
        { error: "Shared Codex review sync is not configured on this deployment." },
        { status: 503 },
      );
    }
    return noStoreJson({
      saved: true,
      reviewMonth: saved.reviewMonth,
      filename: saved.filename,
      generatedAt: saved.generatedAt,
      includedArticleCount: saved.includedArticleCount,
      sourceUpdatedAt: saved.sourceUpdatedAt,
    });
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
