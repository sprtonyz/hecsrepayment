import type { FxProvider, FxRate } from "@/lib/fx/types";
import type { Currency } from "@/lib/storage/types";

export class FrankfurterProvider implements FxProvider {
  async getRate(base: Currency, quote: Currency, date = "latest"): Promise<FxRate> {
    if (base === quote) {
      return {
        base,
        quote,
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
        asOf: new Date().toISOString(),
        provider: "manual",
      };
    }

    const endpoint =
      date === "latest"
        ? "https://api.frankfurter.app/latest"
        : `https://api.frankfurter.app/${date}`;
    const search = new URLSearchParams({ from: base, to: quote });
    const response = await fetch(`${endpoint}?${search.toString()}`, {
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!response.ok) {
      throw new Error(`Frankfurter request failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.[quote];
    if (!rate) {
      throw new Error("Frankfurter response did not include requested FX rate.");
    }

    return {
      base,
      quote,
      rate,
      date: data.date || new Date().toISOString().slice(0, 10),
      asOf: new Date().toISOString(),
      provider: "frankfurter",
    };
  }
}
