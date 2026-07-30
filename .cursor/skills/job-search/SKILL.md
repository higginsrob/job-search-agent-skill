---
name: job-search
description: >-
  Run targeted job searches across public job boards using the candidate profile
  in this project, filter for target roles, rank up to 100 leads by hire
  likelihood, fraud-check listings, and save leads to the project HTML viewer.
  Use when the user asks to search for jobs, find openings, run a job search,
  scout roles, or refresh job leads.
disable-model-invocation: true
---

# Job Search

Targeted search driven by the candidate profile in [candidate.md](candidate.md).

## Resume prerequisite

Before searching:

1. Check `./resume/` for a resume (`*.pdf` or `*.md`, ignoring `README.md`).
2. If none exists, **stop** and ask the user to add their resume to `./resume/` (see `resume/README.md`).
3. If [candidate.md](candidate.md) or [../job-generate-resume/base-resume.md](../job-generate-resume/base-resume.md) are missing, copy from [candidate.example.md](candidate.example.md) / [../job-generate-resume/base-resume.example.md](../job-generate-resume/base-resume.example.md). If they are still placeholders, derive them from the resume and confirm target roles, location, and stack preferences with the user. Both generated files are gitignored — never commit personal profile content.
4. If the files exist but look **stale** vs `./resume/` (user says the resume changed, or facts clearly disagree), point them to [/job-sync-resume](../job-sync-resume/SKILL.md) instead of re-deriving prefs mid-search. Do not silently overwrite target roles / stack tables / hard excludes during a search run.

Then read:

- [candidate.md](candidate.md) — profile, target titles, must-haves, soft filters
- [sites.md](sites.md) — public boards and search strategy
- [ranking.md](ranking.md) — hire-likelihood scoring
- [fraud-checks.md](fraud-checks.md) — scam / misleading listing checks
- [companies.md](companies.md) — per-company AI briefs shown atop listing previews

**Source toggles:** Before searching, read `leads/sources.json` (create from `leads/sources.example.json` if missing). Skip any board whose `source` id is listed in `disabled`. The Sources view in the HTML board writes this file. If the file is missing or `disabled` is empty, search **all** primary sources in [sites.md](sites.md).

After a lead is saved, tailor application materials with:

- [/job-generate-resume](../job-generate-resume/SKILL.md) `<lead-folder>` → `resume.pdf` (always addresses `missing_gaps`; asks unless answered in `gap-answers.md`)
- [/job-generate-cover-letter](../job-generate-cover-letter/SKILL.md) `<lead-folder>` → `cover-letter.txt` (same gap rule)

To refresh or deepen a company brief (also available as buttons in Company Research):

- [/job-company-detail](../job-company-detail/SKILL.md) `companies/<slug>/` → create/refresh `brief.json`
- [/job-company-detail](../job-company-detail/SKILL.md) `companies/<slug>/ more` → append deeper research

To refresh the profile after editing the master resume:

- [/job-sync-resume](../job-sync-resume/SKILL.md) → updates `base-resume.md` + `candidate.md` and regenerates `resume/resume.{md,html,pdf}` (preserves prefs)

## Defaults

| Setting | Default | Override |
|---------|---------|----------|
| Recency | **Last 30 days (`30d`)** | User may set any window (`1h`, `1d`, `3d`, `1w`, `2w`, `30d`, …). **Persist** the chosen window in `leads/index.json` → `search.recency` until the user changes it again. This window filters **what to fetch/admit**, not what to wipe from the board |
| Board capacity | Keep up to **100** ranked leads | Do not stop at 20; chat summary may highlight top 10–20 |
| Location bias | From [candidate.md](candidate.md) | Expand only if user asks |
| Titles | From [candidate.md](candidate.md) | User override |
| Stack focus | From [candidate.md](candidate.md) boost / deprioritize tables | User override |
| Board retention (age-prune) | **`max(search window, 30d)`** from `posted_at` (fallback `found_at`) | Short windows only limit **new** hits. Past retention → **mark `dead`** (never delete folders). **In progress / Applied** are never auto-marked dead; they may show a stale warn past retention |

Always search the **persisted window** (default past **30 days**). Prefer adding **recently posted** listings: the newer the `posted_at`, the more likely the lead should enter (or displace) the cache when capacity is tight. Prefer roles that match candidate.md stack **boost** signals over **deprioritize** stacks when filling the board.

## Workflow

Copy and track:

```
Job search progress:
- [ ] 0. Ensure ./resume/ + candidate.md + base-resume.md are ready
- [ ] 1. Resolve filters (recency: user override → saved search.recency → 30d; respect leads/sources.json disabled boards)
- [ ] 2. Search public boards for that window (sites.md; skip disabled sources)
- [ ] 3. Dedupe + hard-filter to target roles; capture compensation
- [ ] 4. Prefer newer posted_at when choosing what to add; score; merge; age-prune; rank
- [ ] 5. Fraud / misleading check each new or updated lead
- [ ] 6. Ensure HTML site exists; write lead folders + manifest
- [ ] 7. Company briefs: create/refresh missing companies/<slug>/brief.json (+ speech.txt)
- [ ] 8. Lead speeches: write leads/<id>/speech.txt for each new or updated lead
- [ ] 9. Summarize top ranks for the user (with links); note total on board
```

### 1. Resolve parameters

- **Recency window (persisted):**
  1. If the user specifies a window this run (`1h`, `1d`, `3d`, `1w`, `2w`, `30d`, “past month”, etc.) → use it
  2. Else if `leads/index.json` has `search.recency` from a prior run → **reuse that** (do not silently reset to default)
  3. Else → default **`30d`**
- Always write the resolved window back to `search.recency` on this run so the preference persists until the user changes it again.
- Optional: company, stack, remote-only, salary floor, exclude recruiters, etc.
- Do **not** invent salary or visa requirements the user did not state — but **do** capture compensation when the posting lists it

### 2. Search

Use web search / fetch against the boards in [sites.md](sites.md). Cover **all enabled** primary sources there each run — not just Greenhouse + LinkedIn. Skip any `source` id listed in `leads/sources.json` → `disabled`. Prefer:

1. ATS boards: Greenhouse / Lever / Ashby / Workday / SmartRecruiters / Workable + company career pages
2. Aggregators: LinkedIn Jobs, Indeed, Google Jobs, Levels.fyi, TrueUp, Otta/WTTJ, Dice
3. Remote + startup/community: RemoteOK, We Work Remotely, Himalayas, Wellfound, YC, Built In (local), HN “Who’s Hiring”
4. Role-specific queries from [candidate.md](candidate.md)

For each raw hit capture: **title, company, location/remote, posted time, compensation (if listed), sources (every board where it appeared), canonical URL**.

Classify `work_mode` from the posting (required on every lead). Use location prefs from candidate.md when deciding preferred-metro vs other onsite:

| `work_mode` | When |
|-------------|------|
| `remote` | Fully / primarily remote (region OK per candidate.md) |
| `hybrid` | Hybrid / hub days / multi-office with in-person expectation |
| `local-office` | In-office (or primarily onsite) in the candidate’s preferred metro |
| `other` | Onsite elsewhere with no remote / preferred-metro path |

Also keep free-text `location` and boolean `remote` (`true` when remote-eligible). Prefer preferred-metro / remote / hybrid over pure distant onsite when ranking (per candidate.md).

**Compensation:** always try to extract a short display string into `compensation` (e.g. `"$180k–$240k"`, `"$95/hr"`, `"€120k–€150k"`). If the posting has no pay range, set `"compensation": null` (UI only shows a compensation badge when a value is present). Never invent a band.

**Recency / age:** Skip listings older than the **resolved search window** when age is known (`posted_at`). If age is unknown, set `posted_at: null` and only include if the listing otherwise looks freshly active (and prefer known-fresh posts over unknowns when capacity is tight).

**Prefer recent adds:** When choosing among many qualifying hits, rank addition priority by newer `posted_at` first (then hire-likelihood). A strong role posted 2 hours ago should beat an equally strong role posted 2 weeks ago for a contested board slot. Within the window, always bias toward fresher posts.

### 3. Hard filter (must pass)

Include only if the role is a strong match for target roles in [candidate.md](candidate.md). Typical senior+ buckets (adjust to the candidate):

- Staff / Principal / Lead Software Engineer (IC)
- Senior Full Stack / Senior Software Engineer (senior+)
- Engineering Manager / AI Engineering Manager / Head of Engineering (hands-on or small-team)
- Platform / Infrastructure / Data+ML platform with staff-level scope
- Similar titles listed in candidate.md

Exclude roles matching **Hard excludes** in candidate.md (junior/mid, pure mobile-only when not targeted, unpaid cofounder bait, etc.).

**Stack preference (soft, but strong):** Prefer candidate.md **Boost** stacks. Roles whose identity is a **Deprioritize** stack may still be saved if title/scope otherwise fit, but **do not prioritize** them — lower hire-likelihood per [ranking.md](ranking.md) and drop them first when capacity is tight. Incidental mention of a deprioritized language in a boost-stack JD is fine.

### 4. Score, merge, age-prune, and rank (up to 100)

Score with [ranking.md](ranking.md). Every result **must** include the original posting URL.

Then merge into the saved board:

1. Upsert by canonical URL (update existing; never duplicate)
2. **Preserve** `applied` / `applied_at`, `interviews`, `status` (`active` | `in_progress` | `applied` | `interview` | `dead`) / `dead_reason`, and existing `compensation` if the new scrape has none
3. **Age prune (mandatory each run) — mark dead only, never delete folders:** prefer `posted_at`; else `found_at`. Let `S` = the resolved **search/fetch** window. Let retention `W` = **`max(S, 30d)`** in days (so short fetch windows still keep Active leads live up to **30 days** unless the user asks to tighten). **Never auto-mark-dead a lead with status `in_progress`, `applied`, or `interview`.** (Legacy `applied: true` without that status counts as protected too.)
   - Age **> W**, status is **not** `in_progress` / `applied` / `interview` (and not legacy applied) → set `status: "dead"` + `dead_reason` like `"Past retention window (Nd)"` and sync `leads/index.json`. **Do not** remove the lead folder or drop the manifest entry.
   - Age **> W**, status is `in_progress`, `applied`, or `interview` → **keep** as-is (do **not** mark dead); the HTML viewer shows a **stale** warning (`Nd old`)
   - Already-`dead` leads stay dead (refresh `dead_reason` only if useful); never delete them.
   - **Do not** treat a short fetch window as permission to clear the Active lane. “Past 3 hours” means only **admit new** postings from that window.
4. Assign continuous `rank` **1..N** across **all leads on the board** (including dead) sorted by `hire_likelihood` desc (ties: stronger title match → clearer ATS URL → newer `posted_at`)
5. Soft cap: prefer ≤ **100** non-dead leads. If over 100 non-dead after merge/age-prune, **mark dead** lowest-ranked unprotected `active` leads with **oldest `posted_at`** (then oldest `found_at`), with `dead_reason` like `"Capacity — displaced for fresher/stronger matches"`. Never mark `in_progress`, `applied`, or `interview` dead for capacity without asking. **Never delete folders** to free capacity.

Do **not** leave overflow leads as `rank: null` — every lead on the board gets a rank.

When the board is near capacity, **prefer admitting newer postings** over older ones with similar scores — mark unprotected older `active` leads **dead** before skipping a fresh strong match.

**Hard rule — no deletes:** This skill must **never** delete `leads/<id>/` or remove a lead from `leads/index.json`. The only retirement path is `status: "dead"` (+ optional `dead_reason`). If the user says “delete,” mark dead instead (and say so).

### 5. Fraud / quality investigation

For each **new or updated** lead this run, run [fraud-checks.md](fraud-checks.md). Set:

- `fraud_flag`: `clear` | `caution` | `suspicious`
- `fraud_notes`: short evidence bullets

Do not discard suspicious listings silently — keep them ranked but flagged so the user can decide. Re-check existing leads only if the JD/URL changed materially.

### 6. Persist to the HTML site

Project root: this repo.

**If the site is missing** (`index.html`, `assets/`, `leads/` not present), recreate it from the templates described below (or restore from this skill’s expectations). Prefer not to overwrite existing `leads/` data. If `leads/index.json` is missing, copy from `leads/index.example.json`. Lead folders, `index.json`, and `companies/` are gitignored — never commit personal board data.

For each new lead:

1. Create folder: `leads/<slug>/`
2. Write `meta.json` (schema below) — include `work_mode` and `location`
3. Write `posting.md` (title, company, summary, why it fits, missing gaps, fraud notes, original URL). Include sections:

```markdown
## Summary
…

## Why it fits
…

## Missing gaps
- …   # or "None — no material gaps vs profile."
```

Keep `missing_gaps` in `meta.json` in sync with the posting bullets (same 0–5 items).
4. Write `speech.txt` — a spoken briefing for the board’s Speak button (see **Lead speech** below). Refresh it whenever the lead’s JD / fit / gaps / company brief materially change.
5. Update `leads/index.json` (manifest) — include `work_mode` and `location` on each entry
6. Ensure a company brief + company `speech.txt` exists (step 7 / [companies.md](companies.md))

**Slug:** `YYYYMMDD-HHMM-<company-kebab>-<short-title-kebab>` (ASCII, lowercase). If a lead with the same canonical URL already exists, update it instead of duplicating.

#### Lead speech (`speech.txt`)

Plain prose for the ear (no markdown, bullets, or URLs). Roughly **90–180 seconds** aloud (~180–360 words). Cover, in order:

1. **The role / JD** — title, company, location/work mode, compensation if known, and what the job is asking for
2. **The company** — short context from `companies/<slug>/brief.json` when present (products + hiring posture); otherwise what you know from the posting
3. **Why you’d be a good fit** — grounded in `fit_summary` / Why it fits and candidate.md anchors
4. **Gaps to fill** — honest pass on `missing_gaps` so the listener knows what could filter them out; if none, say so

Open with the job title and company; close with one actionable takeaway (apply, dig deeper on a gap, or deprioritize).

**TTS pronunciation (required):** Write so a browser voice can read it without stumbling. Prefer speakable forms over symbols and dense shorthand:

- **Money:** “one hundred ninety-five to two hundred fifty-five thousand dollars”, not `$195k–$255k`
- **Percents / counts:** “fifteen percent”, “three teams”, not `15%` / `3 teams` when the digit form is awkward mid-sentence
- **Years / dates:** “twenty twenty-six”, “July thirtieth”, not bare `2026` / `7/30` when spoken clarity matters
- **Ranges / arrows:** “zero to one”, “React and Python”, not `0→1` / `React/Python`
- **Acronyms:** expand or spell phonetically on first use — “large language model”, “A I”, “S D K”, “software engineer” (for SWE), “engineering manager” (for EM), “New York City” (for NYC), “United States”. Prefer spaces between letters over dotted forms like `A.I.` (dots get mis-split by the player).
- Avoid raw URLs, markdown, and tables; say the idea in a short sentence instead

The board also normalizes common patterns at play time, but **author speakable prose in `speech.txt`** so the transcript matches what was intended.

**Never delete lead folders** — not for age, capacity, fraud, or user “delete” wording. Age/capacity retirement is **mark dead** only. Never auto-mark-dead `in_progress`, `applied`, or `interview` for age/capacity.

### 7. Company briefs

For each distinct company among leads touched this run (and ideally any company on the board still missing a brief): follow [companies.md](companies.md). Create `companies/<company-slug>/brief.json` only when missing or stale (>30 days). Whenever you create or refresh a brief, also write `companies/<slug>/speech.txt` (spoken summary — see [job-company-detail](../job-company-detail/SKILL.md)). The HTML viewer shows the brief at the **top** of the listing preview and plays company `speech.txt` from Company Research.

### 8. Lead speeches

For each **new or updated** lead this run, write `leads/<id>/speech.txt` (schema above). If a lead is untouched this run, leave its existing speech alone. If `speech.txt` is missing on an otherwise retained lead you already opened for merge/fraud, fill it while you’re there.

#### `meta.json` schema

```json
{
  "id": "20260727-1530-acme-staff-engineer",
  "title": "Staff Software Engineer",
  "company": "Acme",
  "location": "Remote (US)",
  "remote": true,
  "work_mode": "remote",
  "posted_at": "2026-07-27T12:00:00Z",
  "found_at": "2026-07-27T15:30:00Z",
  "compensation": "$180k–$240k",
  "url": "https://jobs.example.com/...",
  "source": "greenhouse",
  "sources": ["linkedin", "greenhouse"],
  "rank": 1,
  "hire_likelihood": 86,
  "fit_summary": "One sentence why this candidate is a strong hire for this role.",
  "missing_gaps": [
    "Ads domain experience not evidenced on resume",
    "gRPC / Thrift not listed (JD requires service frameworks)"
  ],
  "target_bucket": "staff-engineer",
  "fraud_flag": "clear",
  "fraud_notes": [],
  "status": "active",
  "dead_reason": null,
  "applied": false,
  "applied_at": null,
  "interviews": [],
  "has_resume": false,
  "has_cover_letter": false,
  "tags": ["typescript", "node", "react", "platform"]
}
```

`status`: `active` | `in_progress` | `applied` | `interview` | `dead` (Kanban swim lanes). Moving to **Applied** also sets `applied: true` + `applied_at`; leaving Applied for `active` / `in_progress` / `dead` clears those flags. Moving to **Interview** clears `dead_reason` but **preserves** `applied` / `applied_at` and `interviews`.

`interviews`: array of `{ id, at, label, notes }` for scheduled or past interviews (`at` = ISO datetime; `label` / `notes` short strings). Default `[]`. Preserve on search merge. Sync onto `leads/index.json` so cards can show the next upcoming interview.

`fit_summary`: one sentence tying candidate.md experience anchors to the JD.  
`missing_gaps`: **0–5** short strings for required/important JD items not evidenced on the candidate profile or base resume (domain, stack, years, level, location, title). Empty array when none. Be honest; omit nice-to-haves and fluff. These explain hire_likelihood — they do not replace the score.  
`work_mode`: `remote` | `hybrid` | `local-office` | `other`  
`compensation`: short pay-range string from the posting, or `null` if missing (UI omits the badge when null)  
`posted_at`: ISO posting time from the board when known, else `null` (UI recency badges: `NEW 1h` / `NEW 1d` for ≤1 day, then `3d` / `1w` / `2w` / `30d`; in-progress/applied/interview + stale past the window shows `Nd old`)  
`source`: primary/canonical board for the saved URL (prefer ATS: greenhouse, lever, ashby, workday, smartrecruiters, workable, company, etc. — see `source` ids in [sites.md](sites.md))  
`sources`: **all** boards where this role was seen this run or on prior merges (e.g. `["linkedin", "greenhouse"]`). Always include `source`. On URL merge, **union** new discovery boards into existing `sources` — do not drop LinkedIn/Indeed just because the canonical URL is ATS.  
`applied`: mirror of Applied swim lane (`true` when `status` is `applied`; may remain true after moving to Interview)  
`applied_at`: ISO timestamp when moved to Applied, or `null`  
`interviews`: see above; also mirrored on each `leads/index.json` entry  
`has_resume`: `true` when `<lead>/resume.pdf` exists (set by job-generate-resume)  
`has_cover_letter`: `true` when `<lead>/cover-letter.txt` exists (set by job-generate-cover-letter)  
`target_bucket`: from candidate.md role buckets (e.g. `staff-engineer` | `senior-fullstack` | `ai-eng-manager` | `similar`)

#### `leads/index.json`

```json
{
  "updated_at": "2026-07-27T15:30:00Z",
  "search": {
    "recency": "30d",
    "found_at": "2026-07-27T15:30:00Z",
    "note": "Optional short note about coverage / fewer-than-20, etc."
  },
  "leads": [
    {
      "id": "20260727-1530-acme-staff-engineer",
      "title": "Staff Software Engineer",
      "company": "Acme",
      "rank": 1,
      "hire_likelihood": 86,
      "fraud_flag": "clear",
      "status": "active",
      "applied": false,
      "applied_at": null,
      "interviews": [],
      "source": "greenhouse",
      "sources": ["linkedin", "greenhouse"],
      "location": "Remote (US)",
      "work_mode": "remote",
      "posted_at": "2026-07-27T12:00:00Z",
      "compensation": "$180k–$240k",
      "url": "https://jobs.example.com/...",
      "path": "leads/20260727-1530-acme-staff-engineer/",
      "has_resume": false,
      "has_cover_letter": false
    }
  ]
}
```

Always set `search.recency` to the **resolved** window (default `30d`; reuse the prior `search.recency` when the user does not override; also `1h` / `1d` / `3d` / `1w` / `2w` / … when the user sets one) and `search.found_at` (ISO) on each search run so the board can show the window and how stale it is. That `search.recency` value **is** the persisted preference for the next run. Preserve `search` when mutating status/applied/interviews/dead via the API helper.

Always sync `posted_at` and `compensation` onto each manifest entry (needed for list badges without opening every `meta.json`).

Keep `leads` in `index.json` sorted by `rank` ascending (1 = best hire likelihood). After every search, **re-rank the full retained set** (up to 100) — including older leads not touched this run — so the board always reflects current hire-likelihood order.

### 9. User summary

Present a ranked table for the **top 10–20** (chat brevity); state total leads on the board:

1. Rank · Title · Company · Hire score · Fraud flag · Posted · **URL**
2. 1–2 lines on why #1–#3 are strongest
3. Call out any `caution` / `suspicious` flags across the board
4. Point to the local viewer: open `index.html` (or serve the repo root) — full ranked list lives there

## Site operations (when user asks)

| User intent | Action |
|-------------|--------|
| Mark applied | Set `status: "applied"`, `applied: true` + `applied_at` (ISO now); clear `dead_reason`; sync `leads/index.json` |
| Unmark applied / leave Applied | Set `status` to `active` (or another lane), `applied: false`, clear `applied_at` (Interview status preserves applied flags) |
| Mark dead | Set `status: "dead"` + optional `dead_reason` in that lead’s `meta.json`; sync `leads/index.json`. **This is the only retirement path.** |
| Mark in progress | Set `status: "in_progress"`, clear `dead_reason` / applied flags; sync `leads/index.json` |
| Mark interview | Set `status: "interview"`, clear `dead_reason`; **preserve** `applied` / `applied_at` / `interviews`; sync `leads/index.json` |
| Set interviews | Write `interviews: [{ id, at, label, notes }, …]` on the lead (ISO `at`); sync `leads/index.json` |
| Delete lead | **Not allowed.** Map to **Mark dead** (say so). Never remove `leads/<id>/` or drop the manifest entry |
| Re-open / revive | Set `status: "active"`, clear `dead_reason` / applied flags |
| Set status | Set `status` to `active` \| `in_progress` \| `applied` \| `interview` \| `dead` (sync applied flags per rules above; clear `dead_reason` unless dead) |
| Refresh search | Run full workflow; merge by URL; age-prune = mark dead past retention `max(search window, 30d)` (never delete folders; short fetch windows must not clear Active); never auto-mark-dead `in_progress` / `applied` / `interview`; do not wipe status/applied/interviews for kept leads |

## HTML site contract

Root files the skill must ensure exist:

- `index.html` — board UI (Kanban swim lanes, filters, detail, Company Research view, set status, mark dead)
- `assets/styles.css`
- `assets/app.js`
- `leads/index.json` — if missing, copy from `leads/index.example.json` (gitignored; never commit personal board data)
- `companies/` — per-company `brief.json` files (see [companies.md](companies.md); gitignored)

Viewer behavior (implemented in `assets/app.js`):

- Load `leads/index.json`, then each lead’s `meta.json` / `posting.md` as needed
- Lead detail shows **Why it fits** (`fit_summary`) and **Missing gaps** (`missing_gaps` list; “None noted.” when empty/absent)
- Lead detail **Speak** plays `leads/<id>/speech.txt` when present; while speaking, show play / back / forward / stop plus a browser-voice select (voice choice persisted in `localStorage`)
- Load `companies/<slug>/brief.json` for the selected lead’s company and show it atop the preview
- Show company icons from `companies/<slug>/icon.*` (via brief `icon` / `/api/companies`) on lead cards, lead detail, and Company Research; fall back to initials when missing
- Kanban columns: **Active** / **In progress** / **Applied** / **Interview** / **Dead** (drag-and-drop + detail menu status actions)
- Browser history: selecting leads/companies and switching views pushes `#leads/<id>`, `#companies/<slug>`, `#sources` so Back/Forward work
- **Sources** view: enable/disable boards globally; persists to `leads/sources.json`; disabled sources are hidden from the board filter and skipped on search runs
- Filter: active / in_progress / applied / interview / dead / all; **location / work_mode**; fraud flag; **source** (matches any entry in `sources`, among enabled boards); search text
- Company Research view: company list + brief preview from `companies/<slug>/brief.json`; **Speak** plays `companies/<slug>/speech.txt` with the same transport + voice select
- Show work-mode labels: Fully remote · Hybrid · Local office · Other location
- Show **compensation** badge only when a range string is present
- Show **recency** badges from `posted_at` (fallback `found_at`): `NEW 1h` · `NEW 1d` (≤1 day) · `3d` · `1w` · `2w` · `30d`; for in-progress/applied/interview leads older than the search window show a stale warning (`Nd old`). In-progress/applied/interview leads are never auto-marked dead by age-prune; lead folders are never deleted.
- Lead detail **Interviews** section (when status is `interview` or `interviews` is non-empty): add/edit/remove rows with datetime, label, notes; **Save interviews** via API `set_interviews`
- Kanban cards show a badge for the next upcoming interview when present
- Show **all** source badges from `sources` (fallback to singular `source`)
- Open original posting in a new tab
- Show icon links to `resume.pdf` / `cover-letter.txt` when present (list + detail); all document and external links open in a new tab
- Set status (active · in_progress · applied · interview · dead) / mark dead via UI **when served over a local helper**, or instruct the agent to apply filesystem changes if the static file:// UI cannot write. UI “delete” must **mark dead**, not remove folders.

  Prefer the project helper (supports set-status / set-interviews / mark-applied / mark-dead / revive from the UI; `delete` aliases to mark-dead):

```bash
make server
# → http://127.0.0.1:8765
```

(`make dev` watches board files and restarts on change.)

If using plain `python3 -m http.server 8765`, the board is read-only; the agent applies set-status / mark-dead on the filesystem when the user asks — **never** deletes lead folders.

When creating new leads, default `status: "active"`, `applied: false`, `applied_at: null`, `interviews: []`, `has_resume: false`, and `has_cover_letter: false`. On URL merge refresh, **preserve** existing `status` / `applied` / `applied_at` / `interviews` / `has_resume` / `has_cover_letter` values.

## Quality bar

- Never invent job URLs — only real postings found this run
- Never claim a posting is “verified safe”; only report investigation flags
- Prefer company ATS links over aggregator mirrors when both exist (keep aggregators in `sources`)
- Be honest when few qualify inside the window; save what exists, re-rank the full board, and say so
- Prefer **newer** postings when filling toward 100; grow the board with strong window matches rather than leaving it sparse
- Prefer **boost-stack** leads over deprioritized-stack specialists when choosing what to admit or keep near capacity
- After each run, report the **search/fetch window used** (and whether it came from user override vs saved preference), the **retention floor** for age-prune (`max(search, 30d)`), how many leads were **marked dead** for age/capacity (never deleted), and how many `in_progress` / `applied` / `interview` stale leads remain (past retention, retained)
