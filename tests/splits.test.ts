import { describe, expect, it } from "vitest";
import { adjustSharesForSplits, cumulativeSplitFactorAfterDate } from "@/lib/domain/splits";
import { splitFixture } from "./fixtures";

describe("split adjustment", () => {
  it("adjusts original sold shares after the sale date", () => {
    expect(adjustSharesForSplits(10, splitFixture, "2020-01-01", "2026-05-20")).toBe(40);
  });

  it("adjusts purchase shares after the trade date", () => {
    expect(adjustSharesForSplits(2, splitFixture, "2020-02-01", "2026-05-20")).toBe(8);
  });

  it("calculates the cumulative split factor", () => {
    expect(cumulativeSplitFactorAfterDate(splitFixture, "2020-01-01", "2026-05-20").toNumber()).toBe(4);
  });
});
