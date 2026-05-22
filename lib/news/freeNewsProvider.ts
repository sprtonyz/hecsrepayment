import { buildNewsDigest, scoreNewsText } from "@/lib/news/sentiment";
import { companyNameForSymbol, isRelevantNewsArticle } from "@/lib/news/relevance";
import type { NewsArticle, NewsDigest, NewsProviderName } from "@/lib/news/types";

type FreeNewsProvider = {
  provider: NewsProviderName;
  label: string;
  buildUrl(symbol: string, companyName: string): string;
  parse(xml: string, symbol: string): NewsArticle[];
};

const USER_AGENT = "AAPL Catch-Up Tracker/0.1 RSS news digest";

export async function fetchFreeNewsDigest(symbol: string): Promise<NewsDigest> {
  const normalizedSymbol = symbol.toUpperCase();
  const companyName = companyNameForSymbol(normalizedSymbol);
  const providers = freeNewsProvidersForSymbol(normalizedSymbol);
  const settled = await Promise.all(
    providers.map(async (provider) => {
      try {
        const xml = await fetchFeed(provider.buildUrl(normalizedSymbol, companyName));
        return {
          provider: provider.provider,
          articles: provider
            .parse(xml, normalizedSymbol)
            .filter((article) => isRelevantNewsArticle(article, normalizedSymbol)),
        };
      } catch {
        return {
          provider: provider.provider,
          articles: [],
          failed: true,
        };
      }
    }),
  );

  return buildNewsDigest(
    normalizedSymbol,
    settled.flatMap((result) => result.articles),
    new Date().toISOString(),
    settled.flatMap((result) => (result.failed ? [result.provider] : [])),
  );
}

function freeNewsProvidersForSymbol(symbol: string): FreeNewsProvider[] {
  const googleNewsUrl = (query: string) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const providers: FreeNewsProvider[] = [
    {
      provider: "yahooFinance",
      label: "Yahoo Finance",
      buildUrl: (ticker) =>
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
      parse: (xml, ticker) => parseRssItems(xml, ticker, "yahooFinance", "Yahoo Finance"),
    },
    {
      provider: "googleNewsMarket",
      label: "Google News - market",
      buildUrl: (ticker, companyName) => {
        const query = `${ticker} OR "${companyName}" stock when:30d`;
        return googleNewsUrl(query);
      },
      parse: (xml, ticker) => parseRssItems(xml, ticker, "googleNewsMarket", "Google News"),
    },
    {
      provider: "googleNewsFundamentals",
      label: "Google News - fundamentals",
      buildUrl: (_ticker, companyName) =>
        googleNewsUrl(`"${companyName}" (earnings OR revenue OR services OR buyback) when:30d`),
      parse: (xml, ticker) => parseRssItems(xml, ticker, "googleNewsFundamentals", "Google News"),
    },
    {
      provider: "googleNewsProducts",
      label: "Google News - products",
      buildUrl: (_ticker, companyName) =>
        googleNewsUrl(`"${companyName}" (iPhone OR "Apple Intelligence" OR Siri OR "Vision Pro" OR Mac) when:30d`),
      parse: (xml, ticker) => parseRssItems(xml, ticker, "googleNewsProducts", "Google News"),
    },
    {
      provider: "googleNewsRegulatory",
      label: "Google News - regulatory",
      buildUrl: (_ticker, companyName) =>
        googleNewsUrl(`"${companyName}" (antitrust OR "Digital Markets Act" OR DMA OR DOJ OR "App Store") when:30d`),
      parse: (xml, ticker) => parseRssItems(xml, ticker, "googleNewsRegulatory", "Google News"),
    },
    {
      provider: "googleNewsSupplyChain",
      label: "Google News - supply chain",
      buildUrl: (_ticker, companyName) =>
        googleNewsUrl(`"${companyName}" (China OR India OR tariff OR Foxconn OR "supply chain") when:30d`),
      parse: (xml, ticker) => parseRssItems(xml, ticker, "googleNewsSupplyChain", "Google News"),
    },
  ];

  if (symbol === "AAPL") {
    providers.push({
      provider: "appleNewsroom",
      label: "Apple Newsroom",
      buildUrl: () => "https://www.apple.com/newsroom/rss-feed.rss",
      parse: (xml, ticker) => parseAtomEntries(xml, ticker, "appleNewsroom", "Apple Newsroom"),
    });
  }

  return providers;
}

async function fetchFeed(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.8",
        "user-agent": USER_AGENT,
      },
      next: { revalidate: 900 },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`News feed request failed: ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssItems(
  xml: string,
  symbol: string,
  provider: NewsProviderName,
  providerLabel: string,
) {
  return matchBlocks(xml, "item").flatMap((item) => {
    const title = readTag(item, "title");
    const url = readTag(item, "link");
    if (!title || !url) {
      return [];
    }
    const summary = readTag(item, "description");
    const publishedAt = parseDate(readTag(item, "pubDate"));
    const source = readTag(item, "source") || providerLabel;
    return buildArticle({
      symbol,
      title,
      summary,
      url,
      source,
      provider,
      publishedAt,
    });
  });
}

function parseAtomEntries(
  xml: string,
  symbol: string,
  provider: NewsProviderName,
  providerLabel: string,
) {
  return matchBlocks(xml, "entry").flatMap((entry) => {
    const title = readTag(entry, "title");
    const url = readAttribute(entry, "link", "href");
    if (!title || !url) {
      return [];
    }
    const summary = readTag(entry, "summary") || readTag(entry, "content");
    const publishedAt = parseDate(readTag(entry, "published") || readTag(entry, "updated"));
    return buildArticle({
      symbol,
      title,
      summary,
      url,
      source: providerLabel,
      provider,
      publishedAt,
    });
  });
}

function buildArticle(input: {
  symbol: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  provider: NewsProviderName;
  publishedAt?: string;
}): NewsArticle[] {
  const sentiment = scoreNewsText(input.title, input.summary);
  return [
    {
      id: stableArticleId(input.provider, input.symbol, input.url || input.title),
      symbol: input.symbol.toUpperCase(),
      title: input.title,
      summary: input.summary,
      url: input.url,
      source: input.source,
      provider: input.provider,
      publishedAt: input.publishedAt,
      signal: sentiment.signal,
      signalScore: sentiment.signalScore,
      matchedTerms: sentiment.matchedTerms,
    },
  ];
}

function matchBlocks(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  return Array.from(xml.matchAll(pattern), (match) => match[0]);
}

function readTag(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(pattern);
  return match ? cleanXmlText(match[1]) : "";
}

function readAttribute(xml: string, tag: string, attribute: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, "i");
  const match = xml.match(pattern);
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function cleanXmlText(value: string) {
  return decodeXmlEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeXmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === "amp") {
      return "&";
    }
    if (normalized === "lt") {
      return "<";
    }
    if (normalized === "gt") {
      return ">";
    }
    if (normalized === "quot") {
      return "\"";
    }
    if (normalized === "apos") {
      return "'";
    }
    if (normalized === "nbsp") {
      return " ";
    }
    if (normalized.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return entity;
  });
}

function parseDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  return new Date(timestamp).toISOString();
}

function stableArticleId(provider: NewsProviderName, symbol: string, value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `${provider}-${symbol.toUpperCase()}-${hash.toString(36)}`;
}
