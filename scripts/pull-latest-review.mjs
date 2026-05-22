import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const { default: nextEnv } = await import("@next/env");
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const sourceUrl = normalizeBaseUrl(readOption("--source") || process.env.REVIEW_SOURCE_URL);
const symbol = (readOption("--symbol") || "AAPL").toUpperCase();
const reviewMonth = readOption("--review-month");
const limit = readOption("--limit");
const reviewToken = process.env.SHARED_REVIEW_TOKEN?.trim();

const endpoint = new URL("/api/codex-review/latest", sourceUrl);
endpoint.searchParams.set("symbol", symbol);
if (reviewMonth) {
  endpoint.searchParams.set("reviewMonth", reviewMonth);
}
if (limit) {
  endpoint.searchParams.set("limit", limit);
}

const response = await fetch(endpoint, {
  headers: reviewToken ? { "x-review-token": reviewToken } : undefined,
});
const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : `Could not pull the latest review bundle: ${response.status}`;
  throw new Error(message);
}

if (!payload?.bundle || typeof payload.filename !== "string") {
  throw new Error("The review endpoint did not return a bundle payload.");
}

const outputDirectory = path.join(process.cwd(), "data", "news-review-queue");
const outputPath = path.join(outputDirectory, payload.filename);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload.bundle, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify(
    {
      path: outputPath,
      symbol,
      reviewMonth: payload.reviewMonth,
      cachedArticleCount: payload.cachedArticleCount,
      cachedAnalysisCount: payload.cachedAnalysisCount,
      includedArticleCount: payload.includedArticleCount,
      sourceUrl: endpoint.toString(),
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

function normalizeBaseUrl(value) {
  const fallback = "https://hecs-repayment.vercel.app";
  if (!value) {
    return fallback;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
