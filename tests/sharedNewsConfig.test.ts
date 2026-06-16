import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "@/lib/shared-news/config";

describe("Supabase config normalization", () => {
  it("strips rest API paths from the configured Supabase URL", () => {
    expect(normalizeSupabaseUrl("https://example.supabase.co/rest/v1")).toBe(
      "https://example.supabase.co",
    );
  });

  it("preserves the project origin for a plain Supabase URL", () => {
    expect(normalizeSupabaseUrl("https://example.supabase.co/")).toBe(
      "https://example.supabase.co",
    );
  });
});
