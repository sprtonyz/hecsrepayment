import { NextRequest, NextResponse } from "next/server";
import { buildCodexReviewBundle } from "@/lib/news/codexReviewBundleBuilder";
import { getSharedNewsConfig } from "@/lib/shared-news/config";
import { getLatestSharedNewsSnapshot } from "@/lib/shared-news/store";

const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,12}$/;

export async function GET(request: NextRequest) {
  const unauthorized = requireSharedReviewToken(request);
  if (unauthorized) {
    return unauthorized;
  }

  const searchParams = request.nextUrl.searchParams;
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const reviewMonth = searchParams.get("reviewMonth") || undefined;
  const limit = parseArticleLimit(searchParams.get("limit"));

  if (!SYMBOL_PATTERN.test(symbol)) {
    return noStoreJson({ error: "Invalid symbol." }, { status: 400 });
  }

  if (reviewMonth && !/^\d{4}-\d{2}$/.test(reviewMonth)) {
    return noStoreJson({ error: "Invalid reviewMonth." }, { status: 400 });
  }

  try {
    const snapshot = await getLatestSharedNewsSnapshot(symbol, reviewMonth);
    if (!snapshot.enabled) {
      return noStoreJson(
        {
          error:
            "Shared review sync is not configured. Add Supabase credentials to enable Review Latest.",
        },
        { status: 503 },
      );
    }

    if (!snapshot.reviewMonth || snapshot.articles.length === 0) {
      return noStoreJson(
        {
          error: `No shared ${symbol} articles are available yet.`,
        },
        { status: 404 },
      );
    }

    const result = await buildCodexReviewBundle({
      symbol,
      reviewMonth: snapshot.reviewMonth,
      articles: snapshot.articles,
      analyses: snapshot.analyses,
      articleLimit: limit,
      guideContext: {
        generatedFrom: "sharedNewsSync",
        generatedForDate: new Date().toISOString().slice(0, 10),
        sharedSync: {
          reviewMonth: snapshot.reviewMonth,
          sourceUpdatedAt: snapshot.sourceUpdatedAt,
          cachedArticleCountForMonth: snapshot.articles.length,
          cachedAnalysisCountForMonth: snapshot.analyses.length,
        },
      },
    });

    return noStoreJson({
      symbol,
      reviewMonth: snapshot.reviewMonth,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      cachedArticleCount: snapshot.articles.length,
      cachedAnalysisCount: snapshot.analyses.length,
      includedArticleCount: result.includedArticleCount,
      filename: result.filename,
      bundle: result.bundle,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not build the latest shared Codex review bundle.",
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

function parseArticleLimit(value: string | null) {
  const parsed = Number(value || "20");
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(40, Math.max(1, Math.round(parsed)));
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
