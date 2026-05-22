import type { NewsArticle } from "@/lib/news/types";

export function companyNameForSymbol(symbol: string) {
  if (symbol.toUpperCase() === "AAPL") {
    return "Apple";
  }
  return symbol.toUpperCase();
}

export function isRelevantNewsArticle(article: NewsArticle, symbol: string) {
  const normalizedSymbol = symbol.toUpperCase();
  const companyName = companyNameForSymbol(normalizedSymbol);
  if (article.provider === "appleNewsroom" && normalizedSymbol === "AAPL") {
    return true;
  }
  const text = `${article.title} ${article.summary ?? ""}`.toLowerCase();
  return includesWholeTerm(text, normalizedSymbol.toLowerCase()) || includesWholeTerm(text, companyName.toLowerCase());
}

function includesWholeTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}
