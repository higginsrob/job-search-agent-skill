---
name: job-generate-cover-letter
description: >-
  Write a short, simple cover letter (.txt) tailored to a saved job lead folder.
  Always addresses meta.missing_gaps (asks unless already answered in
  gap-answers.md). Use when the user runs /job-generate-cover-letter, asks for a
  cover letter for a lead, or wants a brief application letter matched to a JD.
disable-model-invocation: true
---

# Generate cover letter

Argument: **path to a lead folder** (e.g. `leads/20260727-2035-acme-staff-engineer/`).

Companion skills: [job-search](../job-search/SKILL.md), [job-sync-resume](../job-sync-resume/SKILL.md), [job-generate-resume](../job-generate-resume/SKILL.md).

## Goal

Write a **short, simple** cover letter as plain text in the lead folder. Always prioritize brevity over storytelling.

## Resume prerequisite

1. Check `./resume/` for a resume (`*.pdf` or `*.md`, ignoring `README.md`).
2. If none exists, **stop** and ask the user to add their resume to `./resume/` (see `resume/README.md`).
3. If [../job-generate-resume/base-resume.md](../job-generate-resume/base-resume.md) or [../job-search/candidate.md](../job-search/candidate.md) are missing, copy from the adjacent `*.example.md` stubs. Ensure both are populated (not stubs). Those generated files are gitignored — never commit personal content.
4. If the profile looks stale vs `./resume/`, suggest [/job-sync-resume](../job-sync-resume/SKILL.md) first.

## Inputs (read first)

| Source | Path |
|--------|------|
| Lead meta | `<lead>/meta.json` (especially `missing_gaps`) |
| Job posting | `<lead>/posting.md` (+ fetch `url` if needed) |
| Candidate prefs | [../job-search/candidate.md](../job-search/candidate.md) |
| Base resume | [../job-generate-resume/base-resume.md](../job-generate-resume/base-resume.md) |
| Tailored resume (if present) | `<lead>/resume.md` |
| Gap answers (if present) | `<lead>/gap-answers.md` |

Prefer `<lead>/resume.md` over the base resume when both exist. If the lead path is invalid, stop and ask.

**Missing gaps (mandatory):** Always read `meta.missing_gaps`. For each item:

1. If already answered in `gap-answers.md` with usable detail → weave that proof into the letter (one clause or sentence in para 2).
2. If unanswered and it is a **skill / domain / tool** gap the letter should address → **stop and ask** (batch unanswered items, max ~5; same honesty rules as resume). Do not invent. Write/append answers to `gap-answers.md`, then write the letter.
3. If unanswered and it is a soft constraint the user cannot fix in a letter (e.g. hybrid office days, pay band, big-tech bar) → do not fake a fix; omit or acknowledge only if truthful and brief. Prefer asking only when an answer could strengthen the letter.

If `missing_gaps` is empty and no critical JD gap remains, write from known resume facts.

## Length & tone (non-negotiable)

- **Short and simple** — about **120–180 words**, never more than **~220**.
- **3 short paragraphs** max (opening → one proof paragraph → close).
- Plain, professional, human. No fluff, no “I am writing to express my interest…”, no buzzword salad, no emoji.
- Specific to **this** company and role in 1–2 concrete ways — not a generic template with names swapped.
- **ASCII punctuation only:** Cover letters are often pasted into ATS forms and opened as plain `.txt` without a charset. Never use em dashes (`—`), en dashes (`–`), or middle dots (`·`). Prefer commas, periods, colons, parentheses, or ASCII `|` / `-` instead (e.g. `Denver, CO | email@example.com` not `Denver, CO · email@example.com`; `I led event ingestion, gigabytes of production ETL` not `I led event ingestion — gigabytes of production ETL`).

## Workflow

```
Cover letter progress:
- [ ] 0. Ensure ./resume/ + candidate profile are ready
- [ ] 1. Load lead + resume + missing_gaps (+ gap-answers)
- [ ] 2. Resolve unanswered missing_gaps (ask if needed; skip already answered)
- [ ] 3. Pick 1–2 true proof points that match the JD (include answered gaps)
- [ ] 4. Write cover-letter.txt (short)
- [ ] 5. Set has_cover_letter on meta.json + leads/index.json
- [ ] 6. Show the letter and path to the user
```

### Gap handling vs resume skill

- **Same source of truth:** `meta.missing_gaps` + `gap-answers.md`. Never re-ask a theme already answered for this lead.
- **Ask before writing** when unanswered skill/domain/tool gaps would leave the letter weak or dishonest.
- Deep resume bullet work still belongs to `/job-generate-resume <lead>`; the cover letter only needs enough truthful detail to address the gaps in 1–2 sentences.
- Do **not** invent. Prefer known resume / gap-answer facts.

### Output

Write `<lead>/cover-letter.txt` using this shape (fill header from candidate.md / base resume):

```text
<Full Name>
<Location> | <email> | <linkedin> | <github or site if present>

Dear <Company> Hiring Team,

<Para 1: role + why this company/team in one clear sentence.>

<Para 2: one concrete proof from real experience aligned to the JD. Address answered missing_gaps here when relevant. Optionally one adjacent strength.>

<Para 3: brief close + thanks.>

Sincerely,
<Full Name>
```

If the hiring manager name is known from the posting, use `Dear <Name>,` instead.

After writing the file, update the lead board flags:

- Set `has_cover_letter: true` in `<lead>/meta.json`
- Sync the same field onto that lead’s entry in `leads/index.json`

Then show the letter and path to the user. Note that the leads board will show a cover-letter icon after refresh.

## Quality bar

- Always short and simple
- Always address `missing_gaps` (ask if unanswered; reuse `gap-answers.md` when present; never invent)
- Only true claims from resume / gap-answers / user
- No degree inflation (match education from the resume; usually omit education in the letter)
- No em dash (`—`), en dash (`–`), or middle dot (`·`) anywhere in `cover-letter.txt`
- Save as `.txt` only (not PDF/Markdown unless the user asks)
