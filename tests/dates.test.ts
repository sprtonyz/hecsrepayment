import { describe, expect, it } from "vitest";
import { isoDateInTimeZone } from "@/lib/domain/dates";

describe("date helpers", () => {
  it("formats Sydney dates using the local Australia/Sydney day boundary", () => {
    const lateUtcOnJune13 = new Date("2026-06-13T16:30:00.000Z");

    expect(isoDateInTimeZone(lateUtcOnJune13)).toBe("2026-06-14");
  });

  it("can format a date in UTC when requested", () => {
    const lateUtcOnJune13 = new Date("2026-06-13T16:30:00.000Z");

    expect(isoDateInTimeZone(lateUtcOnJune13, "UTC")).toBe("2026-06-13");
  });
});
