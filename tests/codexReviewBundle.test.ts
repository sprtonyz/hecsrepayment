import { describe, expect, it } from "vitest";
import { buildCodexReviewBrief } from "@/lib/news/codexReviewBundle";

describe("Codex review bundle brief", () => {
  it("summarizes coverage, duplicate groups, noise flags, and durable theme hints", () => {
    const brief = buildCodexReviewBrief({
      symbol: "AAPL",
      reviewMonth: "2026-05",
      requestedArticleCount: 3,
      includedArticleCount: 3,
      guideContext: {
        generatedFrom: "dashboard",
        generatedForDate: "2026-05-20",
        depositGuide: {
          direction: "hold",
          confidence: "medium",
          recommendedDepositAud: 600,
        },
        newsContext: {
          selectedDigest: {
            signal: "neutral",
            confidence: "high",
            articleCount: 3,
            providerCount: 2,
            analysisMode: "headlineRules",
          },
        },
      },
      articles: [
        article({
          id: "yahoo-alpha",
          title: "Analyze Apple stock on Yahoo Finance's new AI platform AlphaSpace",
          source: "Yahoo Finance",
          provider: "yahooFinance",
          articleTextStatus: "read",
        }),
        article({
          id: "google-alpha",
          title: "Analyze Apple stock on Yahoo Finance's new AI platform AlphaSpace - Yahoo Finance",
          source: "Yahoo Finance",
          provider: "googleNews",
          articleTextStatus: "summaryOnly",
        }),
        article({
          id: "fortnite",
          title: "Apple Faces Renewed App Store Fight as Fortnite Returns",
          source: "Yahoo Finance",
          provider: "yahooFinance",
          articleTextStatus: "read",
        }),
      ],
    });

    expect(brief.coverage.articleTextStatusCounts).toEqual({ read: 2, summaryOnly: 1 });
    expect(brief.coverage.providerCounts).toEqual({ yahooFinance: 2, googleNews: 1 });
    expect(brief.coverage.duplicateGroupCount).toBe(1);
    expect(brief.duplicateGroups[0]?.articleIds).toEqual(["yahoo-alpha", "google-alpha"]);
    expect(
      brief.articleReviewTable.find((row) => row.id === "google-alpha")?.likelyNoiseFlags,
    ).toEqual(["duplicate-title", "summaryOnly-text", "platform-demo"]);
    expect(
      brief.articleReviewTable.find((row) => row.id === "fortnite")?.durableThemeHints,
    ).toContain("legal-regulatory");
    expect(brief.articleReviewTable.find((row) => row.id === "fortnite")?.reviewPriority).toBe("high");
    expect(brief.guideSnapshot.depositGuide?.recommendedDepositAud).toBe(600);
    expect(brief.guideSnapshot.selectedNewsDigest?.analysisMode).toBe("headlineRules");
  });

  it("does not treat recurring company headlines from different periods as duplicates", () => {
    const brief = buildCodexReviewBrief({
      symbol: "AAPL",
      reviewMonth: "2026-05",
      requestedArticleCount: 2,
      includedArticleCount: 2,
      articles: [
        article({
          id: "q2-2024",
          title: "Apple reports second quarter results",
          source: "Apple Newsroom",
          provider: "appleNewsroom",
          articleTextStatus: "read",
          publishedAt: "2024-05-02T00:00:00.000Z",
        }),
        article({
          id: "q2-2025",
          title: "Apple reports second quarter results",
          source: "Apple Newsroom",
          provider: "appleNewsroom",
          articleTextStatus: "read",
          publishedAt: "2025-05-01T00:00:00.000Z",
        }),
      ],
    });

    expect(brief.coverage.duplicateGroupCount).toBe(0);
    expect(brief.articleReviewTable.map((row) => row.likelyNoiseFlags)).toEqual([[], []]);
  });
});

function article({
  id,
  title,
  source,
  provider,
  articleTextStatus,
  publishedAt = "2026-05-19T00:00:00.000Z",
}: {
  id: string;
  title: string;
  source: string;
  provider: string;
  articleTextStatus: "read" | "summaryOnly" | "unavailable";
  publishedAt?: string;
}) {
  return {
    id,
    title,
    source,
    provider,
    publishedAt,
    collectedAt: "2026-05-20T00:00:00.000Z",
    lastFetchedAt: "2026-05-20T00:00:00.000Z",
    ageBucket: "0-3d",
    headlineRuleSignal: "neutral",
    headlineRuleScore: 0,
    matchedTerms: [],
    articleTextStatus,
    readableTextExcerpt: "Excerpt text.",
  };
}
