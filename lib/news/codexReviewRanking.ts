export type CodexReviewRankingInput = {
  appliedNewsDigest?: {
    signal: "positive" | "neutral" | "negative";
    confidence: "low" | "medium" | "high";
    score?: number;
  };
  suggestedGuideImpact?: {
    expectedAdjustmentPercent?: number;
  };
};

export function scoreCodexReviewForComparison(review?: CodexReviewRankingInput) {
  if (!review?.appliedNewsDigest) {
    return -999;
  }

  const digest = review.appliedNewsDigest;
  const digestScoreScale = 1.5;
  const signalWeight =
    digest.signal === "positive" ? 1 : digest.signal === "negative" ? -1 : 0;
  const confidenceWeight =
    digest.confidence === "high" ? 0.35 : digest.confidence === "medium" ? 0.15 : 0;
  const adjustmentWeight =
    typeof review.suggestedGuideImpact?.expectedAdjustmentPercent === "number"
      ? review.suggestedGuideImpact.expectedAdjustmentPercent / 12
      : 0;
  const baseScore = typeof digest.score === "number" ? digest.score / digestScoreScale : 0;
  const rawScore = baseScore + signalWeight * 0.6 + confidenceWeight + adjustmentWeight;
  return Math.round(Math.min(5, Math.max(-5, rawScore)) * 100) / 100;
}
