import { describe, expect, it } from "vitest";
import { scoreCodexReviewForComparison } from "@/lib/news/codexReviewRanking";

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

  it("returns the missing-review sentinel when no digest is present", () => {
    expect(scoreCodexReviewForComparison()).toBe(-999);
  });
});
