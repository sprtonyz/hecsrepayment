export type ArticleTextResult = {
  text: string;
  status: "read" | "summaryOnly" | "unavailable";
};

const MAX_ARTICLE_CHARS = 12_000;
const MIN_READABLE_CHARS = 800;

export async function fetchReadableArticleText(
  url: string,
  fallbackText: string,
): Promise<ArticleTextResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "user-agent": "AAPL Catch-Up Tracker/0.1 article analysis",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackArticleText(fallbackText);
    }

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const readable = contentType.includes("text/plain")
      ? normalizeText(raw)
      : extractTextFromHtml(raw);

    if (readable.length >= MIN_READABLE_CHARS) {
      return {
        text: readable.slice(0, MAX_ARTICLE_CHARS),
        status: "read",
      };
    }

    return fallbackArticleText(fallbackText || readable);
  } catch {
    return fallbackArticleText(fallbackText);
  }
}

function fallbackArticleText(fallbackText: string): ArticleTextResult {
  const text = normalizeText(fallbackText).slice(0, MAX_ARTICLE_CHARS);
  return {
    text,
    status: text ? "summaryOnly" : "unavailable",
  };
}

function extractTextFromHtml(html: string) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(nav|header|footer|aside|form|button|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h1|h2|h3|li|blockquote|article|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeText(decodeHtmlEntities(withoutNoise));
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
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
