# AAPL Catch-Up Tracker

A local-first personal finance app for tracking an AAPL rebuild portfolio against the USD value of the original AAPL position had it been held.

It also includes a school debt decision model for comparing an AAPL cash-out and rebuild path against continuing monthly study-loan repayments, using configurable AUD income, balance, repayment, and June indexation assumptions.

## Setup

Use Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Optional live market data:

```bash
FINNHUB_API_KEY=your_key_here
ALPHA_VANTAGE_API_KEY=
OPENAI_API_KEY=
OPENAI_NEWS_ANALYSIS_MODE=testing
```

Finnhub is used when `FINNHUB_API_KEY` exists. Without it, the app uses the manual provider and demo fallback data. Frankfurter is used for USD/AUD and AUD/USD FX rates. The deposit guide also fetches free RSS headlines from Yahoo Finance, Google News, and, for AAPL, Apple Newsroom through the server-side `/api/news` route. If `OPENAI_API_KEY` is configured, `/api/news/analyze` runs in Testing Mode by default: up to 20 new articles are analyzed with `gpt-5-nano` and no escalation. Set `OPENAI_NEWS_ANALYSIS_MODE=performance` to use Performance Mode, which analyzes with `gpt-5.4-mini` and escalates high-impact or uncertain articles to `gpt-5.4`. Results are cached locally by article and mode.

The dashboard can also prepare a monthly Codex review bundle from the This Month Deposit Guide. It writes up to 20 current-month articles, collected timestamps, readable article excerpts where available, cached API analysis, and guide context to `data/news-review-queue/YYYY-MM-aapl-codex-review.json` for a deeper local review.

## Scripts

```bash
npm run test
npm run lint
npm run build
```

## Market Data Notes

All browser market-data, news, and AI-analysis calls go through Next.js route handlers under `app/api`, so provider API keys are not exposed client-side. Quotes, daily prices, dividends, splits, FX rates, recent news headlines, and AI article analyses are cached in IndexedDB. If a provider request fails, the UI keeps using the last cached value or manual fallback.

Market data can be delayed, incomplete, adjusted differently by each provider, or unavailable for some historical dividend/split ranges. News RSS feeds can be delayed, unavailable, or noisy. Testing Mode AI analysis is deliberately cheap and should be treated as a plumbing check rather than a high-confidence investment judgement. The app ignores tax entirely.

## School Debt Model

The study-loan repayment estimate uses the 2025-26 Australian marginal repayment structure:

- Nil up to A$67,000 repayment income.
- A$67,001 to A$125,000: 15c per A$1 above A$67,000.
- A$125,001 to A$179,285: A$8,700 plus 17c per A$1 above A$125,000.
- A$179,286 and over: 10% of total repayment income.

The model also lets you enter the observed payroll deduction, such as A$594/month, and use that instead of the formula estimate. Indexation is modelled once per year in June using your configured annual assumption.

## Storage

The first version stores all user data locally in IndexedDB through `lib/storage/indexedDb.ts`, behind the `StorageAdapter` interface in `lib/storage/types.ts`.

To switch later to Supabase/Postgres, implement the same `StorageAdapter` methods with Supabase tables for settings, sale events, contributions, trades, cached quotes, prices, dividends, splits, and FX rates, then swap the adapter used by `useTrackerData`.
