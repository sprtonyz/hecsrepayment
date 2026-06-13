import type { CompanyReviewProfile } from "@/lib/news/companyReviewProfiles";
import { getCompanyReviewProfile } from "@/lib/news/companyReviewProfiles";

export type ReviewerSpec = {
  version: string;
  role: string;
  mandate: string;
  posture: string;
  operatingPrinciples: string[];
  materialityTest: string[];
  confidenceRules: string[];
  companyContext: CompanyReviewProfile;
};

export type ReviewerContextOverride = {
  role?: string;
  mandate?: string;
  posture?: string;
  operatingPrinciples?: string[];
  materialityTest?: string[];
  confidenceRules?: string[];
  companyContext?: Partial<CompanyReviewProfile>;
};

export const REVIEWER_SPEC_VERSION = "2026-06-13.1";

export function buildReviewerSpec({
  symbol,
  guideContext,
}: {
  symbol: string;
  guideContext?: Record<string, unknown>;
}): ReviewerSpec {
  const baseCompanyContext = getCompanyReviewProfile(symbol);
  const reviewerContext = recordValue(guideContext, "reviewerContext") as ReviewerContextOverride | undefined;

  return {
    version: REVIEWER_SPEC_VERSION,
    role: reviewerContext?.role?.trim() || "Thesis Impact Analyst",
    mandate:
      reviewerContext?.mandate?.trim() ||
      "Review each article like a senior fundamental equity analyst deciding whether the news meaningfully changes an investment thesis.",
    posture:
      reviewerContext?.posture?.trim() ||
      "Skeptical, evidence-weighted, and conservative about turning headlines into material signals.",
    operatingPrinciples: normalizeStrings(
      reviewerContext?.operatingPrinciples,
      [
      "Separate durable business impact from market noise, duplicates, and commentary.",
      "Prefer primary disclosures, filings, full readable articles, and reputable wires over snippets or recaps.",
      "Use neutral only when the evidence is material and genuinely mixed.",
      "Send low-weight items to staleOrNoisyItems instead of forcing them into the tally.",
      "Judge impact through revenue, margins, growth durability, regulation, competition, and capital allocation.",
      ],
    ),
    materialityTest: normalizeStrings(
      reviewerContext?.materialityTest,
      [
      "Would this change revenue, margins, competitive position, regulation, or capital returns?",
      "Is the article new information rather than repeated commentary or a recap?",
      "Does the effect look durable enough to matter beyond the trading day?",
      "Is the source strong enough to justify a thesis change?",
      ],
    ),
    confidenceRules: normalizeStrings(
      reviewerContext?.confidenceRules,
      [
      "High confidence requires clear, direct evidence and strong source quality.",
      "Medium confidence is appropriate when the mechanism is plausible but not fully resolved.",
      "Low confidence is appropriate for summary-only, duplicated, speculative, or thin evidence.",
      ],
    ),
    companyContext: mergeCompanyContext(baseCompanyContext, reviewerContext?.companyContext),
  };
}

function mergeCompanyContext(
  baseCompanyContext: CompanyReviewProfile,
  overrideProfile: Partial<CompanyReviewProfile> | undefined,
): CompanyReviewProfile {
  if (!overrideProfile) {
    return baseCompanyContext;
  }

  const symbol = typeof overrideProfile.symbol === "string" ? overrideProfile.symbol : baseCompanyContext.symbol;
  const companyName =
    typeof overrideProfile.companyName === "string" ? overrideProfile.companyName : baseCompanyContext.companyName;
  const sector = typeof overrideProfile.sector === "string" ? overrideProfile.sector : baseCompanyContext.sector;
  const thesisDrivers = normalizeStrings(overrideProfile.thesisDrivers, baseCompanyContext.thesisDrivers);
  const keyRisks = normalizeStrings(overrideProfile.keyRisks, baseCompanyContext.keyRisks);
  const materialityKeywords = normalizeStrings(
    overrideProfile.materialityKeywords,
    baseCompanyContext.materialityKeywords,
  );

  return {
    symbol,
    companyName,
    sector,
    thesisDrivers,
    keyRisks,
    materialityKeywords,
  };
}

function recordValue(value: Record<string, unknown> | undefined, key: string) {
  const candidate = value?.[key];
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : undefined;
}

function normalizeStrings(value: string[] | undefined, fallback: string[]) {
  const normalized = value?.map((item) => item.trim()).filter(Boolean);
  return normalized && normalized.length > 0 ? normalized : fallback;
}
