import { describe, expect, it } from "vitest";
import {
  calculateHadHeldDividendCashUsd,
  calculateRebuildDividendCashUsd,
} from "@/lib/domain/dividends";
import {
  dividendFixture,
  saleFixture,
  splitFixture,
  tradeFixture,
} from "./fixtures";

describe("dividend calculations", () => {
  it("calculates cash dividends for the Had I Held baseline", () => {
    expect(
      calculateHadHeldDividendCashUsd(
        saleFixture,
        dividendFixture,
        splitFixture,
        "2026-05-20",
      ),
    ).toBe(20);
  });

  it("calculates cash dividends for the rebuild portfolio", () => {
    expect(
      calculateRebuildDividendCashUsd(
        tradeFixture,
        dividendFixture,
        splitFixture,
        "AAPL",
        "2026-05-20",
      ),
    ).toBe(4);
  });
});
