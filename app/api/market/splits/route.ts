import { NextRequest, NextResponse } from "next/server";
import { activeProviderName, createMarketDataProvider } from "@/lib/market-data/provider";
import type { MarketProviderName } from "@/lib/storage/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const from = searchParams.get("from") || "2020-01-01";
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const preferred = (searchParams.get("provider") || undefined) as MarketProviderName | undefined;

  try {
    const provider = createMarketDataProvider(preferred);
    const splits = await provider.getSplits(symbol, from, to);
    return NextResponse.json({
      provider: activeProviderName(preferred),
      splits,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch splits.",
      },
      { status: 502 },
    );
  }
}
