---
name: job-generate-resume
description: >-
  Tailor the candidate's resume to a saved job lead and write resume.pdf into the
  lead folder. Always addresses meta.missing_gaps (asks unless already answered
  in gap-answers.md). Edits down base resume content to fit the JD (simple,
  professional, concise). Use when the user runs /job-generate-resume, asks to
  generate a resume for a lead, or tailor a resume to a job posting folder.
disable-model-invocation: true
---

# Generate tailored resume

Argument: **path to a lead folder** (e.g. `leads/20260727-2035-acme-staff-engineer/` or absolute path).

Companion skills: [job-search](../job-search/SKILL.md), [job-sync-resume](../job-sync-resume/SKILL.md), [job-generate-cover-letter](../job-generate-cover-letter/SKILL.md).

## Goal

Produce a **one-page, simple, professional, concise** resume PDF tailored to the posting — not a rewrite of the candidate’s career. Prefer editing down and reordering over inventing fluff.

## Resume prerequisite

1. Check `./resume/` for a resume (`*.pdf` or `*.md`, ignoring `README.md`).
2. If none exists, **stop** and ask the user to add their resume to `./resume/` (see `resume/README.md`).
3. If [base-resume.md](base-resume.md) is missing, copy from [base-resume.example.md](base-resume.example.md). Ensure it is populated from that resume (not the stub). If still a stub, extract it now and sync [../job-search/candidate.md](../job-search/candidate.md) as needed. `base-resume.md` and `candidate.md` are gitignored — never commit personal content.
4. If `base-resume.md` exists but is clearly behind `./resume/`, suggest [/job-sync-resume](../job-sync-resume/SKILL.md) before tailoring (or run that sync first if the user wants facts refreshed).

## Inputs (read first)

| Source | Path |
|--------|------|
| Master resume(s) | `./resume/*` (PDF and/or MD) |
| Base resume (edit from this) | [base-resume.md](base-resume.md) |
| Candidate prefs | [../job-search/candidate.md](../job-search/candidate.md) |
| Lead meta | `<lead>/meta.json` (especially `missing_gaps`) |
| Job posting | `<lead>/posting.md` (+ fetch `url` if JD text is thin) |
| Prior gap answers (if any) | `<lead>/gap-answers.md` |

If the lead path is missing or lacks `meta.json`, stop and ask for a valid lead folder.

## Workflow

Copy and track:

```
Resume progress:
- [ ] 0. Ensure ./resume/ + base-resume.md are ready
- [ ] 1. Load lead + base resume + full JD
- [ ] 2. Resolve gaps from missing_gaps (+ JD) vs gap-answers
- [ ] 3. If unanswered gaps: ask user (do not generate yet)
- [ ] 4. Write/update gap-answers.md + tailored resume.md
- [ ] 5. Build resume.html from template → render resume.pdf
- [ ] 6. Set has_resume on meta.json + leads/index.json
- [ ] 7. Confirm paths to the user
```

### 1. Load context

- Resolve the lead folder; read `meta.json` and `posting.md`.
- If posting summary is thin, fetch the canonical `url` and extract requirements / nice-to-haves.
- Read [base-resume.md](base-resume.md) as the only factual source for experience (plus any `gap-answers.md`).

### 2. Skill gap analysis (mandatory)

**Always address `meta.missing_gaps`** (and the matching `## Missing gaps` bullets in `posting.md`). That list is the board’s JD-vs-profile gap set — treat every item as in-scope unless already answered.

Also scan the JD for any **additional** required/important skills not already listed in `missing_gaps`.

Compare each item to base resume + `<lead>/gap-answers.md`. Classify:

| Class | Meaning |
|-------|---------|
| Covered | Clear evidence on the resume **or** already answered in `gap-answers.md` with usable detail |
| Stretch | Related experience; can emphasize honestly |
| **Gap (unanswered)** | In `missing_gaps` or required/important from the JD, and **not** evidenced / not yet answered |

**Skip questioning** for any theme already covered in `gap-answers.md` (reuse those answers; fold Resume addition bullets into the tailored resume).

**If there is one or more unanswered Gaps: stop before writing the resume.** Ask the user short, concrete questions — one skill/theme per question, driven by the unanswered `missing_gaps` first. Examples:

- “The lead’s missing gaps call out Kafka. Have you used it in production? Where, and what did you own?”
- “They want Ruby/Rails. Any professional Rails work, or only adjacent backend?”
- “Do you have measurable scale numbers for [employer] traffic we can cite?”

Rules for questioning:

- Cover every **unanswered** `missing_gaps` item that can be answered with experience (max ~5 questions per run; batch them). Soft location/comp/bar notes may be acknowledged in the letter later rather than asked if the user cannot change them — still ask when the gap is about skills, domain work, or tools.
- Never invent experience. If the user says no, omit that skill — do not fake it. Record the “no” in `gap-answers.md` so we do not re-ask.
- If the user provides detail, turn it into honest resume bullets/skills (their words, tightened).

Write / append answers to `<lead>/gap-answers.md`:

```markdown
# Gap answers — <Company> · <Title>
Updated: <ISO date>

## <Skill or theme>
Q: ...
A: ...
Resume addition:
- ...
```

If every `missing_gaps` item is already answered (or the list is empty) and no new JD gaps appear, skip questioning and note that briefly.

### 3. Tailor content

Write `<lead>/resume.md` by editing down the base resume:

1. **Summary** — 2–4 lines aimed at this role; mirror JD language only where true.
2. **Experience** — keep employers unless the user asks otherwise; cut bullets that do not help; lead with the strongest JD-aligned bullets; **fold in gap-answer bullets** (from answered `missing_gaps`) under the right employer (or a short “Additional” note only if needed). Unanswered “no” gaps stay off the resume.
3. **Skills** — reorder to front-load JD matches; drop irrelevant clutter; add only skills the user confirmed or that already exist in the base.
4. **Length** — target **one page** when rendered. Cut ruthlessly.
5. **Honesty** — no fake titles, employers, degrees, or tools.

Voice: simple, professional, concise. No first-person in bullets. No emoji. No “passionate about.”

**Typography:** Never use the em dash (`—`) in resume output (`resume.md`, `resume.html`, `resume.pdf`). Replace every em dash with a comma (and normal spacing), e.g. `Acme Corp, Jan 2020 – Mar 2023` or `event ingestion, gigabytes of production ETL`. En dashes in date ranges (`–`) are fine.

### 4. Render PDF

1. Copy [resume-template.html](resume-template.html) → `<lead>/resume.html`.
2. Replace the `<!--BODY-->` marker with semantic HTML for the tailored resume (`h1`, `.headline`, `.contact`, `h2`, `h3`, `.role`, `p`, `ul`/`li`). Set `<title>` to the candidate’s name + “Resume”. Do not change the stylesheet unless fixing a clear print bug.
3. Render:

```bash
python3 .cursor/skills/job-generate-resume/scripts/render_resume_pdf.py \
  "<lead>/resume.html" \
  "<lead>/resume.pdf"
```

4. Leave `resume.md`, `resume.html`, and `resume.pdf` in the lead folder. Optionally delete `resume.html` only if the user prefers PDF-only — default **keep all three**.
5. Update the lead board flags so icons appear:
   - Set `has_resume: true` in `<lead>/meta.json`
   - Sync the same field onto that lead’s entry in `leads/index.json` (create/update the entry’s `has_resume`)

### 5. Done

Tell the user:

- Path to `resume.pdf`
- What was emphasized for this JD
- Which `missing_gaps` were addressed via prior/new gap-answers (or that none needed asking)
- That the leads board will show a resume icon after refresh
- Offer `/job-generate-cover-letter <lead>` if they want a letter next

## Quality bar

- One page, readable, ATS-friendly (real text in HTML/PDF — not a screenshot of the old PDF)
- Tailored ≠ keyword-stuffed
- Unanswered `missing_gaps` (and other required JD gaps) → **ask**, then write additional content from answers; never re-ask themes already in `gap-answers.md`
- No em dash (`—`) in `resume.md`, `resume.html`, or `resume.pdf` (use commas instead; en dashes in dates are fine)
- Education must match [base-resume.md](base-resume.md) exactly — never inflate degrees
- Never fabricate employment dates or employers
