import { NextRequest, NextResponse } from "next/server";
import { getAiNewsAnalysisMode } from "@/lib/ai/articleAnalysis";
import { fetchFreeNewsDigest } from "@/lib/news/freeNewsProvider";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();

  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  }

  try {
    const digest = await fetchFreeNewsDigest(symbol);
    return NextResponse.json({
      ...digest,
      aiAnalysisMode: getAiNewsAnalysisMode(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch news.",
      },
      { status: 502 },
    );
  }
}
