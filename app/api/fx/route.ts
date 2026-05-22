import { NextRequest, NextResponse } from "next/server";
import { FrankfurterProvider } from "@/lib/fx/frankfurterProvider";
import type { Currency } from "@/lib/storage/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const base = (searchParams.get("base") || "USD") as Currency;
  const quote = (searchParams.get("quote") || "AUD") as Currency;
  const date = searchParams.get("date") || "latest";

  try {
    const provider = new FrankfurterProvider();
    const rate = await provider.getRate(base, quote, date);
    return NextResponse.json(rate);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch FX rate.",
      },
      { status: 502 },
    );
  }
}
