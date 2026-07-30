# Candidate profile

Derived from `./resume/resume.pdf` and user preferences. Refresh when the resume or targets change via `/job-sync-resume`.

Source resume: `./resume/resume.pdf`  
Editable base (for tailored resumes): `.cursor/skills/job-generate-resume/base-resume.md`  
Sync via `/job-sync-resume` · tailor via `/job-generate-resume <lead-folder>` · cover letters via `/job-generate-cover-letter <lead-folder>`.

Copy this file to `candidate.md` on first setup (or let `/job-search` / `/job-sync-resume` create it). `candidate.md` is gitignored.

## Snapshot

- **Name:** YOUR NAME
- **Headline:** _(e.g. Staff Software Engineer)_
- **Location:** _(city / region)_
- **Contact:** _(email · LinkedIn · GitHub · phone)_
- **Level:** _(e.g. Staff / Lead / 10+ years)_

## Target roles (priority order)

_(Confirm with user — draft from resume)_

1. _(primary title)_
2. _(secondary title)_
3. _(additional titles…)_

## Target stack (priority)

_(Confirm with user — draft from resume experience)_

| Priority | Stack signal | How to treat |
|----------|--------------|--------------|
| **Boost** | _(languages, frameworks, domains to prefer)_ | Prefer for search queries, admission, and hire-likelihood |
| **Neutral / fine** | _(acceptable but not prioritized)_ | Keep and score normally if title/scope fit |
| **Deprioritize** | _(stacks to downrank)_ | Lower stack score; drop first when capacity is tight |

## Strong fit signals (boost score)

- _(career / ownership signals that raise hire-likelihood)_

## Experience anchors (use when matching)

| Org | Role | Highlights |
|-----|------|------------|
| _(Company)_ | _(Title)_ | _(1-line highlights)_ |

## Skills to match against JDs

**Lead with:** _(primary skills)_

Also strong: _(secondary skills)_

**Have but do not chase:** _(skills to omit from search focus)_

## Soft preferences

- **Location bias:** _(preferred metro / remote / hybrid)_
- Prefer _(work modes)_ over _(less preferred)_
- Company type: _(product, startup, etc.)_
- Role shape: _(IC / lead / manager prefs)_

## Hard excludes (unless user overrides)

- Junior / mid / “new grad”
- Roles clearly below the candidate’s level
- Unpaid, equity-only founder bait without a real company
- _(other hard excludes)_

## Setup checklist (agent)

If Snapshot name is still a placeholder, or `base-resume.md` is still the stub:

1. Require a resume in `./resume/`
2. Populate `base-resume.md` from it (from `base-resume.example.md` if missing)
3. Fill `candidate.md` from the resume (from this example if missing)
4. Ask the user to confirm target roles, location bias, stack boost/deprioritize, and hard excludes

Later resume edits: run `/job-sync-resume` (merge facts; preserve prefs).
