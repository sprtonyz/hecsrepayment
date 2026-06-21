# Review Latest Playbook

This file defines what the user means when they say `Review Latest` in a new Codex chat.

## Mission

Pull the newest shared AAPL article bundle, perform a senior investment analyst review, write the resulting `codexReview` back into the local bundle, publish it to the shared backend, and verify the Vercel app can read it.

The review is decision support for the user's AAPL catch-up tracker, not a price target or an instruction to buy or sell. Be precise, skeptical, and evidence-weighted. Do not let weak or irrelevant headlines tally as neutral evidence. If an item has no investment weight, mark it as stale or noisy and exclude it from positive/negative/neutral counts.

## Required Workflow

1. Run `npm run review:latest`.
2. Read the generated bundle path from the command output, usually `data/news-review-queue/YYYY-MM-aapl-codex-review.json`.
3. Inspect `reviewerSpec`, `reviewBrief.reviewerProfile`, `reviewBrief.coverage`, `reviewBrief.articleReviewTable`, `duplicateGroups`, all `articles`, `readableTextExcerpt`, and any `existingApiAnalysis`.
4. For summary-only articles that appear material, inspect the original `url` when accessible so wording, caveats, and source quality are not judged from an RSS headline alone.
5. Decide which articles have material investment weight. Classify each material item as positive or negative unless it is genuinely balanced and material; no-weight items belong in `staleOrNoisyItems`, not in neutral counts.
6. Insert or replace the bundle's top-level `codexReview` object.
7. Run `npm run review:publish`.
8. Verify production can read the published review:

```powershell
$resp = Invoke-RestMethod -Uri 'https://hecs-repayment.vercel.app/api/codex-review-bundle?symbol=AAPL&reviewMonth=YYYY-MM' -Method Get
$resp.codexReview | ConvertTo-Json -Depth 8
```

9. In the final answer, summarize the investment call, the key positives, the key negatives, what was ignored as noise, and confirm the review was published.

## Analyst Standard

Review like a senior equity analyst specializing in public-market investing:

- Pick apart wording. Separate confirmed facts from phrases like `could`, `may`, `likely`, `reportedly`, `according to listings`, and market-commentary framing.
- Weight source quality. Prefer primary company disclosures, regulatory filings, reputable wires, and full readable articles over RSS snippets, syndicated summaries, and generic analyst chatter.
- Separate time horizons. Short-term price action, analyst ratings, and "is it a buy" pieces rarely change the long-term thesis unless they contain concrete evidence about demand, margins, regulation, product adoption, or capital allocation.
- Identify mechanism. Every positive or negative should explain how it could affect revenue growth, margins, multiples, regulatory freedom, product competitiveness, services economics, cash flow, or capital returns.
- Avoid double counting. Duplicate headlines, syndicated rewrites, and repeated versions of the same event count once.
- Treat summary-only articles cautiously. They can inform themes, but they should not drive a strong conclusion unless multiple credible summary-only items point to the same material mechanism.
- Do not default to neutral. Use `neutral` only for material evidence that is genuinely mixed or where positives and negatives offset. Use `staleOrNoisyItems` for low-weight headlines.
- Name unresolved questions. If a headline matters but evidence is thin, put the open question in `unresolvedThemes`.

## Positive Signal Examples

Count as positive only when the evidence has a clear mechanism:

- Demand strength, pricing power, or market-share gain with evidence beyond promotional noise.
- Margin expansion, services mix improvement, or recurring revenue durability.
- Product cycle evidence that plausibly changes revenue trajectory, upgrade rates, or ecosystem lock-in.
- AI monetization or capability evidence tied to adoption, services revenue, device replacement, or competitive moat.
- Regulatory or legal outcomes that protect App Store economics or reduce compliance risk.
- Supply-chain execution that lowers risk or improves gross margin.
- Capital returns or balance-sheet actions that materially improve shareholder value.

## Negative Signal Examples

Count as negative when the evidence has a clear mechanism:

- Regulatory, antitrust, or court developments that threaten App Store fees, payment rules, default placement, or ecosystem control.
- China weakness, discounting, subsidy dependence, or local competition that may pressure iPhone revenue or margins.
- Product delays, AI underperformance, weak adoption, or competitive catch-up risk.
- Margin pressure from promotions, component costs, FX, or mix deterioration.
- Services growth risks from fee compression, fraud, developer churn, or regulatory compliance costs.
- Valuation risk when paired with slowing growth, weaker fundamentals, or credible downgrade reasoning.

## Codex Review Shape

The bundle needs a top-level `codexReview` object shaped for the app:

```json
{
  "codexReview": {
    "appliedNewsDigest": {
      "signal": "positive | neutral | negative",
      "confidence": "low | medium | high",
      "articleCount": 20,
      "providerCount": 0,
      "providers": [],
      "publisherCount": 0,
      "publishers": [],
      "score": 0,
      "headlines": [],
      "positiveArticleCount": 0,
      "negativeArticleCount": 0,
      "neutralArticleCount": 0,
      "materialArticleCount": 0,
      "highMaterialityCount": 0,
      "escalatedCount": 0,
      "analysisMode": "codexReview"
    },
    "longTermThesisSignals": [
      {
        "theme": "Theme name",
        "direction": "positive | negative | neutral",
        "materiality": "low | medium | high",
        "judgement": "Mechanism-focused analyst judgement."
      }
    ],
    "staleOrNoisyItems": [
      {
        "reason": "Why this item should not affect the investment tally."
      }
    ],
    "unresolvedThemes": [],
    "suggestedGuideImpact": {
      "rationale": "Deposit guide impact and why.",
      "expectedAdjustmentPercent": 0,
      "depositSuggestion": "Lean higher | Keep steady | Lean lower",
      "newsSignal": "positive | neutral | negative"
    },
    "rationale": "Concise overall investment thesis update."
  }
}
```

## Scoring Guidance

Use the score as a compact signal for the deposit guide, not as a price target. Treat it as a continuous slider, not a count of buckets:

- `+2.0` to `+3.0`: strong positive thesis evidence from multiple credible, material items with broad confirmation.
- `+0.5` to `+1.5`: modest positive tilt, usually a mix of one stronger item and several weaker supporting items.
- `-0.5` to `-1.5`: modest negative tilt, usually a mix of one stronger item and several weaker supporting items.
- `-2.0` to `-3.0`: strong negative thesis evidence from multiple credible, material items with broad confirmation.
- Around `0`: genuinely balanced material evidence, mixed evidence, or insufficient evidence.

Within each bucket, prefer decimals rather than integers. A `positive` review can still be a `+0.6` if the evidence is real but not broad, or a `+2.4` if it is durable and well supported. Do not flatten all positives, neutrals, or negatives to the same score.

Set `confidence` by evidence quality:

- `high`: multiple credible full-read or primary-source items with clear mechanisms.
- `medium`: mixed source quality, some full-read evidence, or a clear theme with partial confirmation.
- `low`: mostly summary-only, speculative, duplicated, or thin evidence.

## Final Response Pattern

Keep the final response concise:

- State the updated investment signal and confidence.
- Give the top positives and negatives.
- Mention major no-weight/noisy items that were excluded from the tally.
- Confirm `npm run review:publish` succeeded and the production Vercel API returned the updated review.
