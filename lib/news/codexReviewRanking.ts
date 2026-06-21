export type CodexReviewRankingInput = {
  appliedNewsDigest?: {
    signal: "positive" | "neutral" | "negative";
    confidence: "low" | "medium" | "high";
    score?: number;
    articleCount?: number;
    positiveArticleCount?: number;
    negativeArticleCount?: number;
    neutralArticleCount?: number;
    materialArticleCount?: number;
    highMaterialityCount?: number;
    escalatedCount?: number;
  };
  suggestedGuideImpact?: {
    expectedAdjustmentPercent?: number;
  };
};

export const COMPARISON_SCORE_MIN = -5;
export const COMPARISON_SCORE_MAX = 5;
export const COMPARISON_HIGH_CONFIDENCE_THRESHOLD = 2;
const MAX_EXPECTED_ADJUSTMENT_PERCENT = 20;
const HUMAN_SCORE_SOFTENING = 5;

export function scoreCodexReviewForComparison(review?: CodexReviewRankingInput) {
  if (!review?.appliedNewsDigest) {
    return -999;
  }

  const digest = review.appliedNewsDigest;
  const countScore = deriveCountSpreadScore(digest);
  const baseScore = typeof digest.score === "number" ? digest.score : countScore;
  const direction = resolveDirection(digest, baseScore, countScore);
  const breadthScore = resolveBreadthScore(digest, direction);
  const materialityScore = resolveMaterialityScore(digest, direction);
  const confidenceWeight =
    digest.confidence === "high" ? 0.35 : digest.confidence === "medium" ? 0.15 : 0;
  const adjustmentWeight =
    typeof review.suggestedGuideImpact?.expectedAdjustmentPercent === "number"
      ? clamp(
          review.suggestedGuideImpact.expectedAdjustmentPercent,
          -MAX_EXPECTED_ADJUSTMENT_PERCENT,
          MAX_EXPECTED_ADJUSTMENT_PERCENT,
        ) / 12
      : 0;
  const rawScore =
    baseScore * 0.65 +
    countScore * 0.35 +
    breadthScore +
    materialityScore +
    confidenceWeight +
    adjustmentWeight;
  return normalizeComparisonScore(rawScore);
}

export function comparisonScoreToPercent(score: number) {
  const clamped = Math.min(COMPARISON_SCORE_MAX, Math.max(COMPARISON_SCORE_MIN, score));
  return ((clamped - COMPARISON_SCORE_MIN) / (COMPARISON_SCORE_MAX - COMPARISON_SCORE_MIN)) * 100;
}

export function normalizeComparisonScore(rawScore: number) {
  if (!Number.isFinite(rawScore)) {
    return 0;
  }

  const normalized = Math.tanh(rawScore / HUMAN_SCORE_SOFTENING) * COMPARISON_SCORE_MAX;
  return Math.round(Math.min(COMPARISON_SCORE_MAX, Math.max(COMPARISON_SCORE_MIN, normalized)) * 100) / 100;
}

function deriveCountSpreadScore(digest: NonNullable<CodexReviewRankingInput["appliedNewsDigest"]>) {
  const articleCount = Math.max(
    1,
    digest.articleCount ??
      (digest.positiveArticleCount ?? 0) +
        (digest.negativeArticleCount ?? 0) +
        (digest.neutralArticleCount ?? 0),
  );
  const positive = digest.positiveArticleCount ?? 0;
  const negative = digest.negativeArticleCount ?? 0;
  const neutral = digest.neutralArticleCount ?? 0;
  const spread = (positive - negative) / articleCount;
  const directionalCoverage = Math.min(1, (positive + negative) / articleCount);
  const neutralDrag = 1 - Math.min(0.35, neutral / articleCount);
  return roundScore(spread * 3.2 * (0.7 + directionalCoverage * 0.3) * neutralDrag);
}

function resolveDirection(
  digest: NonNullable<CodexReviewRankingInput["appliedNewsDigest"]>,
  baseScore: number,
  countScore: number,
) {
  if (digest.signal === "positive") {
    return 1;
  }
  if (digest.signal === "negative") {
    return -1;
  }
  return Math.sign(baseScore) || Math.sign(countScore) || 0;
}

function resolveBreadthScore(
  digest: NonNullable<CodexReviewRankingInput["appliedNewsDigest"]>,
  direction: number,
) {
  if (direction === 0) {
    return 0;
  }
  const articleCount = Math.max(1, digest.articleCount ?? 0);
  const breadth = Math.min(1, articleCount / 12);
  return direction * breadth * 0.45;
}

function resolveMaterialityScore(
  digest: NonNullable<CodexReviewRankingInput["appliedNewsDigest"]>,
  direction: number,
) {
  if (direction === 0) {
    return 0;
  }
  const articleCount = Math.max(1, digest.articleCount ?? 0);
  const materialCount = digest.materialArticleCount ?? 0;
  const highMaterialityCount = digest.highMaterialityCount ?? 0;
  const escalatedCount = digest.escalatedCount ?? 0;
  const materialDensity =
    (materialCount * 0.18 + highMaterialityCount * 0.28 + escalatedCount * 0.1) / articleCount;
  return direction * Math.min(1.05, materialDensity * 4.5);
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
