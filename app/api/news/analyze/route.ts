import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeArticleWithEscalation, getAiNewsAnalysisMode } from "@/lib/ai/articleAnalysis";
import { fetchReadableArticleText } from "@/lib/news/articleText";
import { upsertSharedNewsAnalyses } from "@/lib/shared-news/store";
import type { NewsArticle } from "@/lib/news/types";

const articleSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  url: z.string().url(),
  source: z.string().min(1),
  provider: z.string().min(1).max(64),
  publishedAt: z.string().optional(),
  signal: z.enum(["positive", "neutral", "negative"]),
  signalScore: z.number(),
  matchedTerms: z.array(z.string()),
});

const bodySchema = z.object({
  symbol: z.string().min(1).max(12),
  articles: z.array(articleSchema).max(20),
});

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const mode = getAiNewsAnalysisMode();
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid article analysis request." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({
      enabled: false,
      mode,
      analyses: [],
      message: "OPENAI_API_KEY is not configured. News headline scoring is still available.",
    });
  }

  const now = new Date().toISOString();
  const analyses = [];
  const failures = [];

  for (const article of body.data.articles as NewsArticle[]) {
    try {
      const articleText = await fetchReadableArticleText(
        article.url,
        `${article.title}\n\n${article.summary ?? ""}`,
      );
      analyses.push(
        await analyzeArticleWithEscalation({
          article,
          articleText,
          apiKey,
          now,
        }),
      );
    } catch (error) {
      failures.push({
        articleId: article.id,
        message: error instanceof Error ? error.message : "Article analysis failed.",
      });
    }
  }

  let sharedSync:
    | {
        enabled: boolean;
        synced: boolean;
        message?: string;
        reviewMonth?: string;
        analysisCount?: number;
        sourceUpdatedAt?: string;
      }
    | undefined;

  try {
    sharedSync = await upsertSharedNewsAnalyses(analyses);
  } catch (error) {
    sharedSync = {
      enabled: true,
      synced: false,
      message: error instanceof Error ? error.message : "Shared analysis sync failed.",
    };
  }

  return NextResponse.json({
    enabled: true,
    mode,
    analyses,
    failures,
    sharedSync,
  });
}
