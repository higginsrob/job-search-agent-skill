---
name: job-company-detail
description: >-
  Create, refresh, or deepen a company research brief under companies/<slug>/.
  Use when the user runs /job-company-detail, clicks Update research or Go deeper
  in Company Research, or asks to research / refresh a company brief.
disable-model-invocation: true
---

# Company detail

Arguments:

1. **company path** (required) — e.g. `companies/dropbox/` or a company name / slug that resolves to that folder
2. **mode** (optional) — omit for a normal create/update; pass `more` to dig deeper and append richer detail

Companion skills: [job-search](../job-search/SKILL.md), [companies.md](../job-search/companies.md).

## Goal

Write or improve `companies/<slug>/brief.json` for the selected company. Safe to run repeatedly; each run should leave the brief more accurate and useful than before.

## Modes

| Invocation | Behavior |
|------------|----------|
| `/job-company-detail companies/<slug>/` | **Update:** create the brief if missing, otherwise refresh every schema field with current public signals. Prefer replacing stale or thin text; keep strong accurate prose when still correct. |
| `/job-company-detail companies/<slug>/ more` | **Go deeper:** keep existing good content and **append / enrich** it with new facts, sources, and nuance. Do not wipe the brief. May be run many times; each pass should add something new (teams, products, fiscal signals, hiring patterns, leadership, tech stack, culture signals, etc.). |

Never invent financials or hiring stats. Prefer public filings, careers pages, news, LinkedIn/Levels signals, and recent postings. Mark uncertainty explicitly.

## Resolve the company folder

1. If the path is `companies/<slug>/` (with or without trailing slash), use that folder.
2. If given a bare name or slug, derive `slug` = lowercase ASCII kebab (same rules as [companies.md](../job-search/companies.md)) and use `companies/<slug>/`.
3. Create the folder if it does not exist.
4. Read existing `brief.json` when present (required for `more`).

If the path is invalid or the company cannot be identified, stop and ask.

## Schema

Follow [companies.md](../job-search/companies.md). Required shape:

```json
{
  "company": "Dropbox",
  "slug": "dropbox",
  "updated_at": "2026-07-30T19:00:00Z",
  "domain": "dropbox.com",
  "icon": "icon.png",
  "products": "…",
  "fiscal_outlook": "…",
  "hiring_trends": "…",
  "similar_role_hires": "…",
  "hiring_profile": "…",
  "sources": ["https://…"]
}
```

- Set `updated_at` to now (UTC ISO-8601) on every successful write.
- Keep each prose field useful; on normal **update**, stay roughly 40–80 words per field unless the user asked for depth.
- On **`more`**, fields may grow longer. Prefer structured additions (new sentences / paragraphs) over rewriting everything. Deduplicate obvious repeats.
- Merge new URLs into `sources` (unique, keep prior sources).
- Set `domain` to the company’s primary website host when known.
- Ensure a local icon file exists under `companies/<slug>/` (see Icon step). Prefer keeping a good existing `icon` on `more` unless refreshing or replacing a bad/missing file.

## Spoken summary (`speech.txt`)

After writing `brief.json`, always write (or refresh) `companies/<slug>/speech.txt`: a **spoken** narration of the brief for the board’s Speak button (Web Speech API).

Requirements:

- Plain prose only — no markdown, bullets, URLs, or section headings
- Write for the ear: short sentences, natural transitions
- Cover every brief field in order: products → fiscal outlook → hiring trends → similar-role hires → hiring profile
- Length: roughly **90–180 seconds** when read aloud (~180–360 words). On `more`, refresh the whole script so it reflects the deeper brief (do not append a second speech)
- Open with the company name; close with a one-line takeaway for someone evaluating similar roles there
- Never invent facts beyond `brief.json`; if a field is unknown, say so briefly

**TTS pronunciation (required):** Browser voices misread symbols and dense acronyms. Author speakable forms:

- **Money / metrics:** “two hundred million dollars”, “twelve percent year over year” — not `$200M` / `12% YoY`
- **Dates / years:** “twenty twenty-five”, “March first” — not `2025-03-01`
- **Acronyms:** expand or letter-spell on first use — “A I”, “large language model”, “S D K”, “United States”; company-specific initialisms said the way employees say them (or spelled with spaces if unclear). Avoid dotted `A.I.` forms.
- **Punctuation shorthand:** “and” for `/` or `&`; “to” for en-dashes and arrows (`→`)

The HTML board applies a light play-time normalizer, but `speech.txt` should already be speakable.

### Example shape (do not copy wording)

```
Pinterest is a visual discovery and shopping platform… [products]. On the fiscal side… [outlook]. Hiring lately… [trends]. For staff and similar roles… [similar_role_hires]. Overall hiring profile… [hiring_profile]. Bottom line: …
```

## Workflow

```
Company detail progress:
- [ ] 1. Resolve companies/<slug>/ + load existing brief.json if any
- [ ] 2. Research (update = full refresh; more = deeper pass)
- [ ] 3. Write brief.json (create / replace fields / append)
- [ ] 4. Write / refresh speech.txt from the brief
- [ ] 5. Fetch / refresh company icon
- [ ] 6. Summarize what changed for the user
```

### Research checklist

Reuse the checklist in [companies.md](../job-search/companies.md). On `more`, also look for gaps not already covered: business units, flagship products, eng org themes, recent funding/earnings, layoffs/hiring freezes, stack clues from JDs, notable leaders, competitor framing, and concrete similar-role signals.

### Icon

After writing `brief.json` (and whenever `icon` is missing or `--force` refresh is warranted):

```bash
python3 scripts/fetch_company_icon.py <slug>
# or with an explicit domain:
python3 scripts/fetch_company_icon.py --domain example.com <slug>
```

The script downloads a favicon/logo into `companies/<slug>/icon.*` and sets `domain` + `icon` on the brief. If the script fails, try once more with an explicit `--domain`, or save a small official logo manually as `icon.png` and set `"icon": "icon.png"`. Do not leave broken remote image URLs in the brief.

### Output

1. Write `companies/<slug>/brief.json`, `speech.txt`, and `icon.*` when available
2. Tell the user the path and whether this was create / update / deeper append
3. Note that Company Research / lead cards will show the icon after refresh, and Speak plays `speech.txt`

## Quality bar

- Only claims backed by sources (or clearly marked unknown)
- No fabricated metrics
- `more` never deletes prior good research; it deepens it
- ASCII-safe company names in paths; display name stays human-readable in `company`
