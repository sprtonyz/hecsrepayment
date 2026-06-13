import { NextRequest, NextResponse } from "next/server";
import { buildCodexReviewBundle } from "@/lib/news/codexReviewBundleBuilder";
import { readLocalCodexReviewBundle } from "@/lib/news/codexReviewLocalStore";
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
    const sharedResult = await buildSharedReviewLatest(symbol, reviewMonth, limit);
    if (sharedResult) {
      return noStoreJson(sharedResult);
    }

    const localBundle = await readLocalCodexReviewBundle(symbol, reviewMonth);
    if (!localBundle) {
      return noStoreJson(
        {
          error:
            reviewMonth
              ? `No local ${symbol} review bundle exists for ${reviewMonth}.`
              : `No local ${symbol} review bundle exists yet.`,
        },
        { status: 404 },
      );
    }

    return noStoreJson(buildLocalFallbackResponse(symbol, reviewMonth, localBundle));
  } catch (error) {
    const localBundle = await readLocalCodexReviewBundle(symbol, reviewMonth);
    if (localBundle) {
      return noStoreJson({
        ...buildLocalFallbackResponse(symbol, reviewMonth, localBundle),
        remoteError: error instanceof Error ? error.message : "Unknown remote failure.",
      });
    }

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

async function buildSharedReviewLatest(symbol: string, reviewMonth: string | undefined, limit: number) {
  const snapshot = await getLatestSharedNewsSnapshot(symbol, reviewMonth);
  if (!snapshot.enabled) {
    return null;
  }

  if (!snapshot.reviewMonth || snapshot.articles.length === 0) {
    return null;
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

  return {
    symbol,
    reviewMonth: snapshot.reviewMonth,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    cachedArticleCount: snapshot.articles.length,
    cachedAnalysisCount: snapshot.analyses.length,
    includedArticleCount: result.includedArticleCount,
    filename: result.filename,
    bundle: result.bundle,
    includedFrom: "sharedNewsSync",
  };
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

function buildLocalFallbackResponse(
  symbol: string,
  requestedReviewMonth: string | undefined,
  localBundle: Record<string, unknown>,
) {
  return {
    filename: stringValue(localBundle, "filename"),
    generatedAt: stringValue(localBundle, "generatedAt"),
    includedArticleCount: numberValue(localBundle, "includedArticleCount"),
    bundle: localBundle,
    symbol,
    reviewMonth: stringValue(localBundle, "reviewMonth") || requestedReviewMonth,
    sourceUpdatedAt: nestedStringValue(localBundle, "guideContext", "sharedSync", "sourceUpdatedAt"),
    includedFrom: "localBundleFallback",
  };
}

function stringValue(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" ? (value[key] as string) : undefined;
}

function numberValue(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" ? (value[key] as number) : undefined;
}

function nestedStringValue(
  value: Record<string, unknown>,
  first: string,
  second: string,
  third: string,
) {
  const firstValue = value[first];
  if (typeof firstValue !== "object" || !firstValue || Array.isArray(firstValue)) {
    return undefined;
  }

  const secondValue = (firstValue as Record<string, unknown>)[second];
  if (typeof secondValue !== "object" || !secondValue || Array.isArray(secondValue)) {
    return undefined;
  }

  const thirdValue = (secondValue as Record<string, unknown>)[third];
  return typeof thirdValue === "string" ? thirdValue : undefined;
}
