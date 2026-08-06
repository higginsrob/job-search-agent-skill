# Scout research playbook

Public-web research for `/job-scout`. No LinkedIn login scraping. Prefer web search + fetch of public pages; when LinkedIn blocks anonymous access, use search snippets and publicly indexed URLs only.

**Critical:** search results often cite expired job IDs (especially Google Careers). A snippet title is not a live posting. Always fetch and verify before saving — see [SKILL.md](SKILL.md) **URL verification**.

## Query packs (per company)

Substitute company name, slug, boost stacks, and target titles from candidate.md:

1. **Careers / ATS (under-indexed roles)**
   - `"<Company>" (careers OR jobs) ("Staff" OR "Principal" OR "Senior") <Boost Stack>`
   - `site:boards.greenhouse.io "<Company>"` / Ashby / Lever / Workday company portals
   - Company `/careers` or `/jobs` pages directly
   - Prefer links whose host is the employer ATS or official careers site — not Hiretik, Outscal, Levels mirrors, or random blogs that reprint JDs

2. **LinkedIn company**
   - `"<Company>" site:linkedin.com/company`
   - `"<Company>" (hiring OR "we're hiring" OR "open role" OR "building the team") site:linkedin.com`

3. **Hiring managers**
   - `"<Company>" ("Engineering Manager" OR "Head of Engineering" OR "Director of Engineering" OR "Staff Engineer" OR "VP Engineering") site:linkedin.com/in`
   - Prefer people clearly on product/platform teams matching candidate anchors

4. **Quiet signals from people**
   - Once you have HM names: `"<Name>" "<Company>" (hiring OR "my team" OR "we're looking" OR backfill) site:linkedin.com`
   - Company blog / eng blog “we're hiring” / “building X” posts

5. **Recruiters**
   - `"<Company>" (recruiter OR "talent acquisition" OR "technical recruiter") site:linkedin.com/in`
   - Agency recruiters who publicly post staff/senior roles at the company

## What counts as a finding

| Kind | When |
|------|------|
| `posting` | A **verified-live** job URL (ATS/careers detail page) that matches candidate target roles — especially ones poorly indexed on LinkedIn/Indeed |
| `outreach` | No verified public posting, but a concrete outreach target with a **verified** HM LinkedIn (or public bio) URL |

Skip vague “they hire sometimes” with no person/URL/evidence.

Every finding needs `work_mode` + `location` + `hire_likelihood` + `fit_summary` + `missing_gaps` (see [SKILL.md](SKILL.md)). Compare office cities to the candidate’s home / preferred metro in candidate.md so hybrid and fully-onsite roles split into home vs away.

## Scoring findings

Use [ranking.md](../job-search/ranking.md) for `hire_likelihood` (0–100). Same weights as board leads: title/scope, boost-stack overlap, level, credibility, location fit, freshness.

- `summary` = what the opportunity is (role/signal description)
- `fit_summary` = why **this** candidate is likely to clear the bar
- `missing_gaps` = honest gaps that already pulled the score down
- `target_bucket` = closest candidate.md target role bucket
- Cap at ~8 findings/company; sort by `hire_likelihood` desc before writing
- `outreach` findings usually score lower than strong live `posting`s unless the HM/team match is unusually concrete

**Do not** create a `posting` finding from:

- Aggregator / SEO mirrors of a JD
- A Google/Bing snippet that shows a careers URL you have not opened
- A reconstructed URL (`…/jobs/results/<id>-…`) guessed from an ID in a blog post
- A page that loads but says “Job not found” / “taken down”

If the only evidence is a stale mirror, either find a live careers URL or save as `outreach` with a verified person/company link — or skip.

## Verify checklist (every URL)

Before writing `findings[].url`, `quiet_signals[].url`, or `hiring_managers[].linkedin_url`:

1. Fetch the URL (follow redirects; store the final careers/ATS URL when it differs)
2. Confirm HTTP success and page content matches the resource (job title on page ≈ finding title; profile is the named person)
3. Reject soft-404 career shells (“Job not found”, empty search results branded as a job page)
4. Only then write the finding

## Quiet signal strength

| Strength | Examples |
|----------|----------|
| `high` | Explicit “hiring for X”, open req mentioned, “DM me if interested” for a matching role |
| `medium` | Team growth, “excited to grow the platform team”, backfill language without a title |
| `low` | Generic culture posts, conference talks with no hiring language |

Only save signals with a **verified** `url` (post, profile activity, or blog). If age is unknown, set `posted_at: null`.

## Hiring manager quality bar

- Must have a **public LinkedIn profile URL** (or clear public bio URL) that you verified or that search clearly indexed as that exact path
- Title should be EM / Director / HoE / Staff+ IC who could influence a hire
- `notes`: optional short context (team, tenure) — do not invent tenure

## Merge rules

- Match findings by `id` or by normalized `(kind, title, url)`
- Keep `board_lead_id` from the previous scout.json
- Keep HM `notes` if the user edited them
- On merge, refresh `hire_likelihood` / `fit_summary` / `missing_gaps` / `work_mode` / `location` from current research (do not freeze stale scores)
- Dedupe quiet signals by URL
- Union recruiter `companies` slugs; never reset `contacted` / `dead` status
- On refresh, drop or rewrite dead `posting` URLs (unless `board_lead_id` is set — then leave the finding, note staleness in chat)
- Sort findings by `hire_likelihood` desc before saving; cap ~8 per company

## Honesty

If search returns nothing useful, write empty arrays and say so in the chat summary. Thin truth beats fabricated “signals.” Dead links are worse than no findings.
