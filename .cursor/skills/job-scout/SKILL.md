---
name: job-scout
description: >-
  Research Lead Finder target companies for off-board roles, LinkedIn hiring
  managers, quiet hiring signals, and recruiters. Use when the user runs
  /job-scout, asks to scout a company, find hiring managers, or hunt quiet
  signals outside public job boards.
disable-model-invocation: true
---

# Job Scout

Off-board research for companies on the Lead Finder target list. Driven by
[candidate.md](../job-search/candidate.md) and [research.md](research.md).

Companion skills: [job-search](../job-search/SKILL.md), [job-company-detail](../job-company-detail/SKILL.md).

## Resume / profile prerequisite

1. Ensure `./resume/` has a resume and [candidate.md](../job-search/candidate.md) exists (same rules as `/job-search`).
2. Read target roles, boost stacks, and location prefs from candidate.md.

## Arguments

| Invocation | Behavior |
|------------|----------|
| `/job-scout` | Research **all** companies in `scout/targets.json` |
| `/job-scout <slug\|company name>` | Research one target (add via `scripts/add_scout_target.py` if missing) |

## Data layout

| Path | Role |
|------|------|
| `scout/targets.json` | UI-managed company list (create from `scout/targets.example.json` if missing) |
| `scout/<slug>/scout.json` | Findings, hiring managers, quiet signals for one company |
| `companies/<slug>/brief.json` | Shared company brief (create/refresh if missing or >30 days stale) |
| `recruiters/<id>/meta.json` + `recruiters/index.json` | Recruiter board entries |

Personal scout/recruiter data is gitignored — never commit real contacts.

## Workflow

Copy and track:

```
Scout progress:
- [ ] 1. Load candidate.md + scout/targets.json
- [ ] 2. Resolve company list (all targets or one arg)
- [ ] 3. For each company: brief + scout.json research
- [ ] 4. Fetch + verify every URL; drop failures
- [ ] 5. Upsert recruiters when found
- [ ] 6. Summarize for the user (include verified vs dropped URL counts)
```

### 1. Load targets

- If `scout/targets.json` is missing, copy from `scout/targets.example.json`.
- If the list is **empty** and no company arg was given: **stop** and ask the user to add companies in the Lead Finder UI (`#scout`) or pass a company name.
- If a company arg is given and not on the list, **add it with a merge-safe tool** (never rewrite the whole file):

```bash
# Preferred — reads-then-merges; safe under concurrent /job-scout runs
python3 scripts/add_scout_target.py "Meta" --domain meta.com

# Or, when make server is running:
curl -s -X POST http://127.0.0.1:8765/api/scout/targets \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","name":"Meta","domain":"meta.com"}'
```

**CRITICAL — do not clobber targets:**

- **Never** `Write` / overwrite `scout/targets.json` with a full company list assembled from memory or an earlier read.
- Concurrent scout runs that rewrite the whole file drop other companies from Lead Finder while leaving orphan `scout/<slug>/scout.json` folders.
- Only add via `scripts/add_scout_target.py` or `POST /api/scout/targets`. To repair orphans: `python3 scripts/add_scout_target.py --sync-orphans`.

### 2. Per company

For each target slug:

1. Ensure `companies/<slug>/` brief exists (follow [companies.md](../job-search/companies.md) / `/job-company-detail` if missing or stale >30 days). Do not deep-`more` unless the user asked.
2. Load existing `scout/<slug>/scout.json` if present (preserve `board_lead_id` on findings and any user `notes` on hiring managers).
3. Research per [research.md](research.md) — public web only.
4. **Verify every URL** before writing (see **URL verification** below). Drop any item whose URL fails.
5. Write `scout/<slug>/scout.json` (schema below). Merge by stable ids; never drop a finding that still has `board_lead_id`.

### 3. Recruiters

When you find in-house TA or agency recruiters clearly tied to a target company or the candidate’s level/stack:

- Upsert `recruiters/<id>/meta.json` with `status: "found"` (default).
- Sync `recruiters/index.json`.
- Do **not** invent emails. Prefer LinkedIn profile URLs.
- Preserve existing `status` / `contacted_at` / `notes` / `dead_reason` on merge (only fill empty fields).

### 4. User summary

Report:

1. Companies researched
2. New / updated findings (title + kind + hire_likelihood + whether already on the board)
3. Hiring managers found (name + title + LinkedIn)
4. High quiet signals
5. New recruiters
6. Point to Lead Finder (`#scout`) and Recruiters (`#recruiters`)

## `scout/<slug>/scout.json` schema

```json
{
  "company": "Gusto",
  "slug": "gusto",
  "updated_at": "2026-08-04T18:00:00Z",
  "linkedin_company_url": "https://www.linkedin.com/company/gusto/",
  "findings": [
    {
      "id": "finding-staff-platform-outreach",
      "title": "Staff / platform engineering outreach",
      "summary": "1–3 sentences: what opportunity or signal this is.",
      "fit_summary": "One sentence: why this candidate is likely to get it (anchors → needs).",
      "kind": "outreach",
      "url": "https://www.linkedin.com/in/…",
      "location": "Denver, CO (hybrid)",
      "work_mode": "hybrid",
      "hire_likelihood": 72,
      "target_bucket": "staff-engineer",
      "missing_gaps": ["No public evidence of X"],
      "compensation": null,
      "posted_at": null,
      "evidence": ["Short evidence bullets or quote snippets"],
      "found_at": "2026-08-04T18:00:00Z",
      "board_lead_id": null
    }
  ],
  "hiring_managers": [
    {
      "id": "hm-jane-smith",
      "name": "Jane Smith",
      "title": "Engineering Manager, Platform",
      "linkedin_url": "https://www.linkedin.com/in/…",
      "notes": "",
      "found_at": "2026-08-04T18:00:00Z"
    }
  ],
  "quiet_signals": [
    {
      "id": "signal-2026-08-01-hiring",
      "source": "hiring_manager",
      "author": "Jane Smith",
      "url": "https://www.linkedin.com/posts/…",
      "posted_at": "2026-08-01T00:00:00Z",
      "summary": "What the post signals about hiring.",
      "signal_strength": "high",
      "found_at": "2026-08-04T18:00:00Z"
    }
  ]
}
```

### Field rules

- `findings[].kind`: `outreach` (no public job posting) or `posting` (real role URL found off the usual aggregator path / company careers).
- `findings[].url`: **required**, and must be the URL you actually fetched and verified. For `posting`, that must be the live ATS/careers job page (not a search-result mirror, aggregator cache, or guessed ID). For `outreach`, use a verified HM LinkedIn (or other public bio) URL. **Never invent, guess, or reconstruct job IDs.**
- `findings[].id`: stable kebab id; reuse on refresh when the same opportunity.
- `findings[].location`: free-text location from the posting or known office (e.g. `"Remote (US)"`, `"Denver, CO"`). Null only when truly unknown.
- `findings[].work_mode`: **required** on every finding. Classify from the posting (or known company office policy for outreach) using the candidate’s home / preferred metro from candidate.md:

| `work_mode` | Lead Finder label | When |
|-------------|-------------------|------|
| `remote` | Fully remote | Fully / primarily remote (region OK per candidate.md) |
| `local-office` | Fully in office (home) | Fully onsite; office includes the candidate’s home / preferred metro |
| `other` | Fully in office (away) | Fully onsite; office is outside the candidate’s home / preferred metro |
| `hybrid` | Hybrid (home) | Hybrid / hub days; in-office location is the candidate’s home / preferred metro |
| `hybrid-other` | Hybrid (away) | Hybrid / hub days; in-office location is outside the candidate’s home / preferred metro |

- `findings[].hire_likelihood`: **required** integer **0–100**. Same definition as board leads — how likely **this candidate** is to get the role (not company prestige). Score with [ranking.md](../job-search/ranking.md).
- `findings[].fit_summary`: **required** one sentence tying candidate.md experience anchors to the role’s needs. Distinct from `summary` (what the opportunity is).
- `findings[].missing_gaps`: **0–5** short strings for required/important items not evidenced on the profile. Empty array when none. Explains the score; not a second score.
- `findings[].target_bucket`: one of candidate.md target-role buckets (e.g. `staff-engineer`, `senior-fullstack`, `ai-eng-manager`, `similar`). Default `similar`.
- `findings[].compensation`: string band when listed on the posting; otherwise `null`.
- `findings[].posted_at`: ISO datetime when the JD shows a post/update date; otherwise `null` (do not invent). Distinct from `found_at` (when scout saved it).
- Prefer **≤8 findings per company**, kept/sorted by `hire_likelihood` desc (then newer `posted_at` / `found_at`). Drop weak extras rather than listing every ATS hit.
- `quiet_signals[].source`: `company` | `hiring_manager`
- `quiet_signals[].signal_strength`: `low` | `medium` | `high`
- `quiet_signals[].url` / `hiring_managers[].linkedin_url` / recruiter `linkedin_url`: same verification rules — only URLs you opened.
- `board_lead_id`: set only by the Lead Finder UI promote API — **preserve** on scout merges; never invent lead ids.

## URL verification (mandatory)

Before saving **any** URL into `scout.json`, `recruiters/`, or a company brief `sources` list:

1. **Fetch the URL yourself** (WebFetch / curl / equivalent). Search snippets and third-party job mirrors are **not** proof the link works.
2. **Confirm the page is the intended resource**, not an error / taken-down page. Reject if the body shows e.g. “Job not found”, “This job may have been taken down”, “Page not found”, HTTP 404, or a generic jobs search shell with no matching job title.
3. For `kind: "posting"`: the final URL (after redirects) must be a company ATS or careers **job detail** page, and the on-page title/role must match what you store in `findings[].title`. Prefer the redirected canonical host (e.g. Google’s `www.google.com/about/careers/applications/...` over a dead `careers.google.com` id).
4. For LinkedIn profiles/posts: if anonymous fetch is blocked, you may keep the URL only when a search hit clearly shows that exact `linkedin.com/in/...` or `linkedin.com/posts/...` URL **and** you did not fabricate the path. Prefer omitting over inventing.
5. **If verification fails: do not save the finding/signal.** Prefer fewer real links over dead ones. Optionally note in the chat summary that a candidate posting looked stale.
6. On refresh: re-check existing `posting` URLs; if dead and not promoted (`board_lead_id` null), remove or convert to `outreach` only when a verified HM/profile URL remains.

## Recruiter `meta.json` schema

```json
{
  "id": "20260804-1800-jane-doe-acme-talent",
  "name": "Jane Doe",
  "firm": "Acme Talent",
  "linkedin_url": "https://www.linkedin.com/in/…",
  "email": null,
  "focus": "Staff software / fullstack",
  "notes": "",
  "status": "found",
  "dead_reason": null,
  "found_at": "2026-08-04T18:00:00Z",
  "contacted_at": null,
  "sources": ["https://…"],
  "companies": ["gusto"]
}
```

`status`: `found` | `contacted` | `dead`. Manifest entry in `recruiters/index.json` mirrors list fields (`id`, `name`, `firm`, `status`, `linkedin_url`, `focus`, `companies`, `found_at`, `contacted_at`, `path`).

## Quality bar

- **Hard rule:** every saved URL must have been fetched and verified in this run (or re-verified on refresh). No hallucinated job IDs, no copy-paste of unverified search links
- Every finding must include `hire_likelihood`, `fit_summary`, `missing_gaps`, `work_mode`, and `location` (null location only when truly unknown)
- Never invent LinkedIn profiles, posts, emails, or job URLs
- Prefer company ATS / careers over aggregator mirrors for `posting` findings; never use Hiretik/Outscal/Levels mirrors as `findings[].url`
- Be honest when LinkedIn is blocked or thin — write fewer real findings rather than filler
- Do not promote findings onto the leads board yourself unless the user asks; the UI **Add to leads board** button owns promote/demote
- After research, remind the user they can promote findings in Lead Finder
- In the user summary, briefly note how many posting URLs were verified live vs dropped as dead; list findings ordered by hire_likelihood
