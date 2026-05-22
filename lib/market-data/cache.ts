import { differenceInMinutes, differenceInHours } from "date-fns";
import type { CachedQuote } from "@/lib/storage/types";

export function isApproxUsMarketHours(date = new Date()) {
  const nyTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const weekday = nyTime.find((part) => part.type === "weekday")?.value;
  const hour = Number(nyTime.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(nyTime.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  return isWeekday && minutes >= 9 * 60 + 30 && minutes <= 16 * 60;
}

export function quoteCacheTtlMinutes(quote?: CachedQuote) {
  if (!quote || quote.provider === "manual" || quote.isDelayed) {
    return 12 * 60;
  }
  return isApproxUsMarketHours() ? 15 : 12 * 60;
}

export function isQuoteCacheStale(quote?: CachedQuote, now = new Date()) {
  if (!quote) {
    return true;
  }
  const asOf = new Date(quote.asOf);
  const ttl = quoteCacheTtlMinutes(quote);
  if (ttl >= 60) {
    return differenceInHours(now, asOf) * 60 >= ttl;
  }
  return differenceInMinutes(now, asOf) >= ttl;
}
