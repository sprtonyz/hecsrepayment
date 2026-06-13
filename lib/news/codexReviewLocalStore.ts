import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const REVIEW_DIRECTORY = path.join(process.cwd(), "data", "news-review-queue");

let memoryBundle:
  | {
      filename: string;
      absolutePath: string;
      bundle: Record<string, unknown>;
    }
  | undefined;

export async function readLocalCodexReviewBundle(symbol: string, reviewMonth?: string) {
  const normalizedSymbol = symbol.toUpperCase();
  if (
    memoryBundle &&
    stringValue(memoryBundle.bundle, "symbol") === normalizedSymbol &&
    (!reviewMonth || stringValue(memoryBundle.bundle, "reviewMonth") === reviewMonth)
  ) {
    return memoryBundle.bundle;
  }

  const resolved = reviewMonth
    ? {
        filename: reviewBundleFilename(symbol, reviewMonth),
        absolutePath: path.join(REVIEW_DIRECTORY, reviewBundleFilename(symbol, reviewMonth)),
      }
    : await resolveLatestBundlePath(symbol);

  if (!resolved) {
    return undefined;
  }

  return readBundleFile(resolved.absolutePath);
}

export async function writeLocalCodexReviewBundle(input: {
  symbol: string;
  reviewMonth: string;
  filename?: string;
  generatedAt?: string;
  includedArticleCount?: number;
  codexReview: Record<string, unknown>;
}) {
  const filename = input.filename || reviewBundleFilename(input.symbol, input.reviewMonth);
  const absolutePath = path.join(REVIEW_DIRECTORY, filename);
  await mkdir(REVIEW_DIRECTORY, { recursive: true });

  const existingBundle = await readBundleFile(absolutePath).catch(() => undefined);
  const nextBundle = {
    ...(existingBundle && typeof existingBundle === "object" ? existingBundle : {}),
    symbol: input.symbol.toUpperCase(),
    reviewMonth: input.reviewMonth,
    generatedAt:
      input.generatedAt ||
      (existingBundle && typeof existingBundle.generatedAt === "string"
        ? existingBundle.generatedAt
        : new Date().toISOString()),
    includedArticleCount:
      typeof input.includedArticleCount === "number"
        ? input.includedArticleCount
        : typeof existingBundle?.includedArticleCount === "number"
          ? existingBundle.includedArticleCount
          : undefined,
    codexReview: input.codexReview,
  };

  memoryBundle = {
    filename,
    absolutePath,
    bundle: nextBundle,
  };

  try {
    await mkdir(REVIEW_DIRECTORY, { recursive: true });
    await writeFile(absolutePath, `${JSON.stringify(nextBundle, null, 2)}\n`, "utf8");
  } catch {
    // Production deployments can be read-only; keep the bundle in memory and continue.
  }
  return {
    filename,
    absolutePath,
    bundle: nextBundle,
  };
}

async function resolveLatestBundlePath(symbol: string) {
  const filenames = await readdir(REVIEW_DIRECTORY).catch(() => []);
  const pattern = new RegExp(
    `^\\d{4}-\\d{2}-${escapeRegex(symbol.toLowerCase())}-codex-review\\.json$`,
  );
  const filename = filenames.filter((item) => pattern.test(item)).sort().at(-1);
  if (!filename) {
    return undefined;
  }

  return {
    filename,
    absolutePath: path.join(REVIEW_DIRECTORY, filename),
  };
}

async function readBundleFile(absolutePath: string) {
  return JSON.parse(await readFile(absolutePath, "utf8")) as Record<string, unknown>;
}

function reviewBundleFilename(symbol: string, reviewMonth: string) {
  return `${reviewMonth}-${symbol.toLowerCase()}-codex-review.json`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stringValue(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" ? (value[key] as string) : undefined;
}
