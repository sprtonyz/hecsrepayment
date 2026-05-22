import { describe, expect, it } from "vitest";
import { buildAiNewsDigest } from "@/lib/ai/articleAnalysis";
import { buildNewsDigest, scoreNewsText } from "@/lib/news/sentiment";
import type { NewsArticle, NewsProviderName } from "@/lib/news/types";
import type { CachedNewsAnalysis } from "@/lib/storage/types";

describe("news sentiment digest", () => {
  it("scores positive and negative market headlines", () => {
    expect(scoreNewsText("Apple beats estimates and raises guidance").signal).toBe("positive");
    expect(scoreNewsText("Apple faces antitrust probe after weak demand").signal).toBe("negative");
    expect(scoreNewsText("Apple announces new developer tools").signal).toBe("neutral");
  });

  it("builds a higher-confidence digest from multiple free providers", () => {
    const digest = buildNewsDigest(
      "AAPL",
      [
        article("yahooFinance", "Apple beats estimates as services growth accelerates", 1.4),
        article("yahooFinance", "Analyst upgrades Apple with buy rating", 1.2),
        article("googleNews", "Apple raises outlook on strong iPhone demand", 1.2),
        article("googleNews", "Apple announces new AI partnership", 0.5),
        article("appleNewsroom", "Apple launches new services expansion", 0.5),
        article("appleNewsroom", "Apple expands developer tools", 0.5),
        article("googleNews", "Apple stock rises after record revenue", 1.1),
        article("yahooFinance", "Apple buyback plan draws investor attention", 0.9),
      ],
      "2026-05-20T00:00:00.000Z",
    );

    expect(digest.signal).toBe("positive");
    expect(digest.confidence).toBe("high");
    expect(digest.providerCount).toBe(3);
    expect(digest.publisherCount).toBe(3);
    expect(digest.articleCount).toBe(8);
    expect(digest.headlines.length).toBeGreaterThan(0);
  });

  it("tracks publisher breadth separately from feed providers", () => {
    const digest = buildNewsDigest(
      "AAPL",
      [
        article("googleNewsProducts", "Apple Intelligence feature reaches iPhone users", 0.5, "CNBC"),
        article("googleNewsProducts", "Apple faces App Store pressure in Europe", -0.9, "Reuters"),
        article("googleNewsRegulatory", "Apple antitrust scrutiny continues", -0.9, "European Commission"),
      ],
      "2026-05-20T00:00:00.000Z",
    );

    expect(digest.providerCount).toBe(2);
    expect(digest.publisherCount).toBe(3);
    expect(digest.publishers).toEqual(["CNBC", "European Commission", "Reuters"]);
  });

  it("builds a materiality-weighted AI news digest", () => {
    const digest = buildAiNewsDigest(
      "AAPL",
      [
        analysis("regulatory", "negative", "high", -2, "gpt-5.4"),
        analysis("services", "positive", "medium", 1, "gpt-5.4-mini"),
        analysis("market noise", "neutral", "low", 0, "gpt-5.4-mini"),
      ],
      "2026-05-20T00:00:00.000Z",
    );

    expect(digest.signal).toBe("negative");
    expect(digest.articleCount).toBe(3);
    expect(digest.materialArticleCount).toBe(2);
    expect(digest.highMaterialityCount).toBe(1);
    expect(digest.escalatedCount).toBe(1);
  });
});

function article(
  provider: NewsProviderName,
  title: string,
  score: number,
  source = provider,
): NewsArticle {
  return {
    id: `${provider}-${title}`,
    symbol: "AAPL",
    title,
    url: `https://example.com/${encodeURIComponent(title)}`,
    source,
    provider,
    publishedAt: "2026-05-19T00:00:00.000Z",
    signal: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    signalScore: score,
    matchedTerms: [],
  };
}

function analysis(
  title: string,
  signal: "positive" | "neutral" | "negative",
  materiality: "low" | "medium" | "high",
  thesisImpactScore: number,
  finalModel: string,
): CachedNewsAnalysis {
  return {
    id: `${title}-${finalModel}`,
    articleId: title,
    symbol: "AAPL",
    title,
    url: `https://example.com/${title}`,
    source: title === "regulatory" ? "Google News" : "Yahoo Finance",
    publishedAt: "2026-05-19T00:00:00.000Z",
    analyzedAt: "2026-05-19T00:00:00.000Z",
    analysisMode: finalModel === "gpt-5.4" ? "performance" : "testing",
    primaryModel: "gpt-5.4-mini",
    finalModel,
    escalatedModel: finalModel === "gpt-5.4" ? "gpt-5.4" : undefined,
    articleTextStatus: "read",
    signal,
    confidence: "high",
    materiality,
    thesisImpactScore,
    category: "other",
    timeHorizon: materiality === "high" ? "longTerm" : "mediumTerm",
    rationale: "Test analysis",
    evidence: ["Evidence"],
    riskFlags: signal === "negative" ? ["Risk"] : [],
    opportunities: signal === "positive" ? ["Opportunity"] : [],
    shouldEscalate: finalModel === "gpt-5.4",
    escalationReason: finalModel === "gpt-5.4" ? "High materiality" : "",
  };
}
