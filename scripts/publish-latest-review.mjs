import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const { default: nextEnv } = await import("@next/env");
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const sourceUrl = normalizeBaseUrl(readOption("--source") || process.env.REVIEW_SOURCE_URL);
const reviewToken = process.env.SHARED_REVIEW_TOKEN?.trim();
const explicitPath = readOption("--path");
const explicitSymbol = readOption("--symbol")?.toUpperCase();
const explicitReviewMonth = readOption("--review-month");
const bundlePath = explicitPath
  ? path.resolve(process.cwd(), explicitPath)
  : await resolveBundlePath({
      symbol: explicitSymbol || "AAPL",
      reviewMonth: explicitReviewMonth,
    });

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
if (!bundle?.codexReview || typeof bundle.codexReview !== "object") {
  throw new Error("The local review bundle does not contain a codexReview payload to publish.");
}

const symbol = normalizeSymbol(explicitSymbol || bundle.symbol);
const reviewMonth = normalizeReviewMonth(explicitReviewMonth || bundle.reviewMonth);
const response = await fetch(new URL("/api/codex-review/publish", sourceUrl), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(reviewToken ? { "x-review-token": reviewToken } : {}),
  },
  body: JSON.stringify({
    symbol,
    reviewMonth,
    filename: path.basename(bundlePath),
    generatedAt: stringOrUndefined(bundle.generatedAt),
    includedArticleCount:
      typeof bundle.includedArticleCount === "number" ? bundle.includedArticleCount : undefined,
    sourceUpdatedAt: stringOrUndefined(bundle?.guideContext?.sharedSync?.sourceUpdatedAt),
    codexReview: bundle.codexReview,
  }),
});
const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : `Could not publish the shared review: ${response.status}`;
  throw new Error(message);
}

process.stdout.write(
  `${JSON.stringify(
    {
      published: true,
      path: bundlePath,
      symbol,
      reviewMonth,
      filename: payload.filename,
      sourceUrl: `${sourceUrl}/api/codex-review/publish`,
    },
    null,
    2,
  )}\n`,
);

function readOption(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

async function resolveBundlePath({ symbol, reviewMonth }) {
  const directory = path.join(process.cwd(), "data", "news-review-queue");
  if (reviewMonth) {
    return path.join(directory, `${reviewMonth}-${symbol.toLowerCase()}-codex-review.json`);
  }

  const filenames = await readdir(directory);
  const pattern = new RegExp(`^\\d{4}-\\d{2}-${escapeRegex(symbol.toLowerCase())}-codex-review\\.json$`);
  const filename = filenames.filter((item) => pattern.test(item)).sort().at(-1);
  if (!filename) {
    throw new Error(`Could not find a local ${symbol} review bundle to publish.`);
  }
  return path.join(directory, filename);
}

function normalizeBaseUrl(value) {
  const fallback = "https://hecs-repayment.vercel.app";
  if (!value) {
    return fallback;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeSymbol(value) {
  if (typeof value !== "string" || !/^[A-Z0-9.-]{1,12}$/.test(value)) {
    throw new Error("The review bundle is missing a valid symbol.");
  }
  return value.toUpperCase();
}

function normalizeReviewMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("The review bundle is missing a valid reviewMonth.");
  }
  return value;
}

function stringOrUndefined(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
