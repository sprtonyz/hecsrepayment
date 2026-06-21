import { describe, expect, it } from "vitest";
import {
  COMPARISON_HIGH_CONFIDENCE_THRESHOLD,
  comparisonScoreToPercent,
  normalizeComparisonScore,
  scoreCodexReviewForComparison,
} from "@/lib/news/codexReviewRanking";

describe("codex review comparison scoring", () => {
  it("returns a signed score between -5 and 5 with zero as neutral", () => {
    const score = scoreCodexReviewForComparison({
      appliedNewsDigest: {
        signal: "negative",
        confidence: "medium",
        score: -0.4,
      },
      suggestedGuideImpact: {
        expectedAdjustmentPercent: -0.25,
      },
    });

    expect(score).toBeGreaterThan(-5);
    expect(score).toBeLessThan(0);
  });

  it("compresses strong positive digest scores so they do not all max out at 5", () => {
    const score = scoreCodexReviewForComparison({
      appliedNewsDigest: {
        signal: "positive",
        confidence: "high",
        score: 5.76,
      },
    });

    expect(score).toBeLessThan(5);
    expect(score).toBeGreaterThan(3);
  });

  it("keeps strong raw scores below 5 while still reading as high confidence", () => {
    expect(normalizeComparisonScore(5)).toBeGreaterThan(3);
    expect(normalizeComparisonScore(5)).toBeLessThan(5);
    expect(normalizeComparisonScore(-5)).toBeLessThan(-3);
    expect(normalizeComparisonScore(-5)).toBeGreaterThan(-5);
  });

  it("gives stronger reviews a higher score when the article mix carries more directional weight", () => {
    const lighterScore = scoreCodexReviewForComparison({
      appliedNewsDigest: {
        signal: "positive",
        confidence: "medium",
        articleCount: 6,
        positiveArticleCount: 2,
        negativeArticleCount: 0,
        neutralArticleCount: 4,
        materialArticleCount: 1,
        highMaterialityCount: 0,
        escalatedCount: 0,
        score: 0.8,
      },
    });

    const strongerScore = scoreCodexReviewForComparison({
      appliedNewsDigest: {
        signal: "positive",
        confidence: "medium",
        articleCount: 6,
        positiveArticleCount: 4,
        negativeArticleCount: 0,
        neutralArticleCount: 2,
        materialArticleCount: 3,
        highMaterialityCount: 1,
        escalatedCount: 1,
        score: 0.8,
      },
    });

    expect(strongerScore).toBeGreaterThan(lighterScore);
    expect(strongerScore).toBeGreaterThan(0);
  });

  it("returns the missing-review sentinel when no digest is present", () => {
    expect(scoreCodexReviewForComparison()).toBe(-999);
  });

  it("maps the comparison fit scale from -5 to 5 into a 0 to 100 percent bar", () => {
    expect(comparisonScoreToPercent(-5)).toBe(0);
    expect(comparisonScoreToPercent(0)).toBe(50);
    expect(comparisonScoreToPercent(5)).toBe(100);
    expect(comparisonScoreToPercent(COMPARISON_HIGH_CONFIDENCE_THRESHOLD)).toBe(70);
  });
});
