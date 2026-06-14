import {
  addMonths,
  differenceInCalendarMonths,
  format,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
} from "date-fns";

const DEFAULT_TIME_ZONE = "Australia/Sydney";

export function todayIso() {
  return isoDateInTimeZone(new Date(), DEFAULT_TIME_ZONE);
}

export function nowIso() {
  return new Date().toISOString();
}

export function isoDateInTimeZone(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return format(date, "yyyy-MM-dd");
  }

  return `${year}-${month}-${day}`;
}

export function parseDate(date: string) {
  return parseISO(date);
}

export function compareIsoDates(a: string, b: string) {
  return a.localeCompare(b);
}

export function isOnOrBefore(date: string, limit: string) {
  const left = parseDate(date);
  const right = parseDate(limit);
  return isBefore(left, right) || isEqual(left, right);
}

export function isAfterIso(date: string, limit: string) {
  return isAfter(parseDate(date), parseDate(limit));
}

export function monthsElapsedInclusive(startDate: string, asOfDate = todayIso()) {
  if (isAfterIso(startDate, asOfDate)) {
    return 0;
  }
  return Math.max(0, differenceInCalendarMonths(parseDate(asOfDate), parseDate(startDate)) + 1);
}

export function monthsRemainingInclusive(startDate: string, years: number, asOfDate = todayIso()) {
  const target = addMonths(parseDate(startDate), years * 12);
  return Math.max(0, differenceInCalendarMonths(target, parseDate(asOfDate)));
}

export function targetEndDate(startDate: string, years: number) {
  return format(addMonths(parseDate(startDate), years * 12), "yyyy-MM-dd");
}

export function monthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function addMonthsIso(date: string, count: number) {
  return format(addMonths(parseDate(date), count), "yyyy-MM-dd");
}

export function formatDisplayDate(date?: string) {
  if (!date) {
    return "-";
  }
  return format(parseDate(date), "dd/MM/yy");
}

export function formatDisplayDateTime(date?: string) {
  if (!date) {
    return "-";
  }
  return format(new Date(date), "dd/MM/yy h:mm a");
}
