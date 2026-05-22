import { NextRequest, NextResponse } from "next/server";
import { activeProviderName, createMarketDataProvider } from "@/lib/market-data/provider";
import type { MarketProviderName } from "@/lib/storage/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const preferred = (searchParams.get("provider") || undefined) as MarketProviderName | undefined;

  try {
    const provider = createMarketDataProvider(preferred);
    const quote = await provider.getQuote(symbol);
    return NextResponse.json({
      ...quote,
      provider: activeProviderName(preferred),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch quote.",
      },
      { status: 502 },
    );
  }
}
