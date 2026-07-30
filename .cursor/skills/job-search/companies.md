# Company briefs

Per-company research lives under `companies/<slug>/` and is shared across every lead for that employer.

On-demand refresh from the Company Research UI (or chat):

- `/job-company-detail companies/<slug>/` — create or refresh the brief ([job-company-detail](../job-company-detail/SKILL.md))
- `/job-company-detail companies/<slug>/ more` — dig deeper and append richer detail (safe to repeat)

## When to create or refresh

During a job-search run, for **each distinct company** among new or updated leads:

1. Derive `slug` = lowercase ASCII kebab of the company name (e.g. `Gusto` → `gusto`, `DAT Freight & Analytics` → `dat-freight-analytics`).
2. If `companies/<slug>/brief.json` **does not exist**, research and write it.
3. If it exists and `updated_at` is older than **30 days**, refresh it.
4. Otherwise leave it alone (do not re-research every search).

Outside a search run, prefer `/job-company-detail` when the user asks to update or deepen a single company.

Never invent financials or hiring stats. Prefer public filings, careers pages, news, LinkedIn/Levels signals, and recent postings. Mark uncertainty explicitly.

## `companies/<slug>/brief.json` schema

```json
{
  "company": "Gusto",
  "slug": "gusto",
  "updated_at": "2026-07-28T01:30:00Z",
  "domain": "gusto.com",
  "icon": "icon.png",
  "products": "1–3 sentences: what they sell / main product lines.",
  "fiscal_outlook": "1–3 sentences: recent funding, IPO/public status, revenue/growth signals, layoffs or expansion. Say unknown if unclear.",
  "hiring_trends": "1–3 sentences: eng org direction (AI, platform, growth), open-role volume, notable team focus.",
  "similar_role_hires": "Notes on recent hires or postings matching candidate.md target roles if findable; otherwise say not found.",
  "hiring_profile": "Frequency + quality signal for similar roles: e.g. steady ATS flow vs one-off; JD depth; seniority bar; ghost-job risk.",
  "sources": [
    "https://example.com/about",
    "https://job-boards.greenhouse.io/..."
  ]
}
```

Keep each prose field short (roughly 40–80 words). The board shows this block at the **top** of the listing preview.

Also write `companies/<slug>/speech.txt` whenever you create or refresh the brief (same rules as [job-company-detail](../job-company-detail/SKILL.md) Spoken summary, including **TTS pronunciation** — spell out money, dates, and tricky acronyms). The board’s Speak control on Company Research plays this file.

Optional icon fields:

- `domain` — primary company website host (no scheme), used to fetch the icon
- `icon` — filename under `companies/<slug>/` (usually `icon.png` / `icon.ico`); the board shows it on lead cards, lead detail, and Company Research

Prefer saving a real local file via `python3 scripts/fetch_company_icon.py <slug>` (or the checklist step in [job-company-detail](../job-company-detail/SKILL.md)). Do not hotlink third-party logo CDNs from the UI.

## Research checklist

- [ ] Company site / product pages → `products`
- [ ] Press, earnings, Crunchbase/PitchBook summaries, layoff trackers → `fiscal_outlook`
- [ ] Careers page + recent eng postings volume/themes → `hiring_trends`
- [ ] LinkedIn / news / Levels for similar-level hires → `similar_role_hires`
- [ ] Pattern across open JDs (depth, reqs, location realism) → `hiring_profile`
- [ ] Record real URLs in `sources`
- [ ] Write / refresh `speech.txt` (spoken summary of the brief)
- [ ] Resolve `domain` + save local `icon.*` (script or manual download)

## Link from leads

Lead `meta.json` does **not** embed the brief. The viewer loads `companies/<slug>/brief.json` by company name. Ensure the company string on the lead matches the brief’s `company` field closely enough that slug derivation is stable.
