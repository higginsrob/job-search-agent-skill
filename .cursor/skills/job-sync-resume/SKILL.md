---
name: job-sync-resume
description: >-
  Sync the candidate profile and base resume from ./resume/ after the master
  resume changes. Regenerates resume.md / resume.html / resume.pdf, updates
  base-resume.md, and merges factual updates into candidate.md while preserving
  search preferences (target roles, location, stack boost/deprioritize, hard
  excludes). Use when the user runs /job-sync-resume, updates the resume, asks
  to refresh the candidate profile, or says the profile looks stale relative to
  the resume.
disable-model-invocation: true
---

# Sync resume

Companion skills: [job-search](../job-search/SKILL.md), [job-generate-resume](../job-generate-resume/SKILL.md), [job-generate-cover-letter](../job-generate-cover-letter/SKILL.md).

## Goal

Refresh **factual** profile data from `./resume/` into:

- `./resume/resume.md`, `./resume/resume.html`, `./resume/resume.pdf` (board links)
- [../job-generate-resume/base-resume.md](../job-generate-resume/base-resume.md)
- [../job-search/candidate.md](../job-search/candidate.md)

**Merge, do not blind-rewrite** `candidate.md`. Preserve search preferences unless the user confirms changes.

## Inputs

| Source | Path |
|--------|------|
| Master resume(s) | `./resume/*` (prefer newest `*.pdf`, also use `resume.md` if present) |
| HTML template | [../job-generate-resume/resume-template.html](../job-generate-resume/resume-template.html) |
| PDF renderer | [../job-generate-resume/scripts/render_resume_pdf.py](../job-generate-resume/scripts/render_resume_pdf.py) |
| Base resume | [../job-generate-resume/base-resume.md](../job-generate-resume/base-resume.md) |
| Candidate prefs | [../job-search/candidate.md](../job-search/candidate.md) |
| Templates | [../job-generate-resume/base-resume.example.md](../job-generate-resume/base-resume.example.md), [../job-search/candidate.example.md](../job-search/candidate.example.md) |

## Workflow

```
Sync resume progress:
- [ ] 1. Require ./resume/ content
- [ ] 2. Load existing base-resume.md + candidate.md (create from examples if missing)
- [ ] 3. Diff resume vs base-resume → update base-resume.md
- [ ] 4. Write ./resume/resume.md + resume.html; render resume.pdf
- [ ] 5. Merge factual sections into candidate.md; preserve prefs
- [ ] 6. Ask only about ambiguous / preference-affecting changes
- [ ] 7. Confirm paths + what changed
```

### 1. Resume prerequisite

1. Check `./resume/` for a resume (`*.pdf` or `*.md`, ignoring `README.md`).
2. If none exists, **stop** and ask the user to add one (see `resume/README.md`).
3. Prefer the newest PDF as the factual master; use `resume.md` when it is clearly the edited source of truth (or when no PDF exists).

### 2. Load existing files

- If `base-resume.md` is missing, copy from `base-resume.example.md`, then populate.
- If `candidate.md` is missing, copy from `candidate.example.md`, then populate (first-time setup: also confirm target roles, location, stack boost/deprioritize, hard excludes).
- If either file is still a stub (placeholder `YOUR NAME`), treat as first-time setup.

### 3. Update `base-resume.md`

Rewrite `base-resume.md` from the master resume so it matches current facts:

- Contact, headline, summary
- Experience (employers, titles, dates, bullets)
- Skills, education

Keep the structure of [base-resume.example.md](../job-generate-resume/base-resume.example.md). No em dash (`—`); use commas. En dashes in date ranges (`–`) are fine.

Do **not** invent employers, titles, dates, degrees, or tools.

### 4. Regenerate board resume artifacts

Always write these from the synced content (same facts as `base-resume.md`):

1. **`./resume/resume.md`** — clean markdown resume (name, headline, contact, summary, experience, skills, education). This is what the leads board **md** lightbox loads.
2. **`./resume/resume.html`** — copy [resume-template.html](../job-generate-resume/resume-template.html), replace `<!--BODY-->` with semantic HTML (`h1`, `.headline`, `.contact`, `h2`, `h3`, `.role`, `p`, `ul`/`li`). Set `<title>` to the candidate’s name + “Resume”. Keep the template stylesheet; only tweak spacing if needed to stay **one page**.
3. **`./resume/resume.pdf`** — render:

```bash
python3 .cursor/skills/job-generate-resume/scripts/render_resume_pdf.py \
  "./resume/resume.html" \
  "./resume/resume.pdf"
```

Verify the PDF is one page when practical. These three files power the board links `(pdf, html, md)`.

### 5. Merge into `candidate.md` (preserve prefs)

**Update freely (factual):**

- Snapshot (name, headline, location, contact, level) when resume evidence changed
- Experience anchors table
- Skills to match against JDs (from resume skills + ownership signals)
- Strong fit signals that are clearly evidenced on the resume

**Preserve unless the user asks to change:**

- Target roles (priority order)
- Target stack boost / neutral / deprioritize table
- Soft preferences (location bias, work modes, company type, role shape)
- Hard excludes

If the resume clearly implies a **new** preference-worthy signal (e.g. new headline level, new primary stack), **ask** before changing those sections — do not silently overwrite.

### 6. Ask (only when needed)

Batch short questions (max ~5) when:

- First-time setup (prefs empty / stub)
- Resume changes conflict with existing prefs (e.g. headline moved from Staff → Fullstack but targets still say Staff-only)
- New employers/skills appear that might belong in boost stacks or anchors

Never invent preferences. If the user declines a change, leave prefs as-is.

### 7. Done

Tell the user:

- Paths updated (`base-resume.md`, `candidate.md`, `resume/resume.md`, `resume/resume.html`, `resume/resume.pdf`)
- What factual sections changed
- Which prefs were preserved
- Any questions still open
- Offer `/job-search` to refresh leads with the updated profile

## Quality bar

- Prefs survive resume edits by default
- Facts stay honest and resume-grounded
- Board always gets fresh md + html + pdf from this command
- One command covers base resume, board artifacts, and candidate sync
- `candidate.md` and `base-resume.md` stay gitignored — never commit personal content
- Point stale-profile cases here from other skills; do not re-run full search setup inside `/job-search` when files already exist and only need a refresh
