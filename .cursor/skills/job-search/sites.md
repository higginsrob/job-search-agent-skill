# Job boards & search strategy

Search **publicly available** listings. Prefer primary ATS URLs (Greenhouse, Lever, Ashby, Workday, company `/careers`) when an aggregator and ATS both appear.

Build queries from [candidate.md](candidate.md) (target titles, boost stacks, location). Do not hardcode a single person’s titles or city.

## Primary sources

| Source | Notes | `source` id |
|--------|-------|-------------|
| LinkedIn Jobs | Strong recency filters; use “past month” / custom window matching `search.recency` | `linkedin` |
| Indeed | Broad; verify company and age | `indeed` |
| Greenhouse boards | `boards.greenhouse.io` / company sites | `greenhouse` |
| Lever | `jobs.lever.co` | `lever` |
| Ashby | `jobs.ashbyhq.com` | `ashby` |
| Workday | `*.wd*.myworkdayjobs.com` / company Workday portals | `workday` |
| SmartRecruiters | `jobs.smartrecruiters.com` | `smartrecruiters` |
| Workable | `apply.workable.com` / `*.workable.com` | `workable` |
| Wellfound (AngelList) | Startups; check for real team/product | `wellfound` |
| Levels.fyi Jobs | Comp-aware tech roles | `levels` |
| Otta / Welcome to the Jungle | Product/startup focused | `otta` |
| Company career pages | When named in news or user asks | `company` |
| Built In (city / regional) | Prefer the candidate’s metro when relevant | `builtin` |
| YC Work at a Startup | Startup Staff/Senior roles | `yc` |
| RemoteOK | Remote-first tech; verify age and real employer | `remoteok` |
| We Work Remotely | Remote engineering roles | `weworkremotely` |
| Himalayas | Remote job board; good Staff/Senior filters | `himalayas` |
| Dice | Tech-heavy; often includes contract + full-time | `dice` |
| TrueUp | Tech hiring tracker / open roles at growth companies | `trueup` |
| Google Jobs | Aggregator; follow through to ATS when possible | `google-jobs` |
| HN “Who’s Hiring” | Monthly threads (`site:news.ycombinator.com Who is hiring`); parse recent month only | `hackernews` |

**Coverage expectation:** each search run should hit **enabled** aggregators (LinkedIn, Indeed, Google Jobs, TrueUp, Levels), **ATS site: queries** (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable), **remote boards** (RemoteOK, We Work Remotely, Himalayas), and **startup/community** (Wellfound, YC, Otta/WTTJ, Built In, HN Who’s Hiring) — except any id listed in `leads/sources.json` → `disabled`. Do not stop after Greenhouse + LinkedIn alone when those sources are still enabled.

The HTML **Sources** view toggles these ids globally. Default (missing file / empty `disabled`) = all on.

Use web search queries that include site filters when helpful. Substitute titles, stacks, and locations from candidate.md, e.g.:

- `"<Target Title>" OR "<Peer Title>" (Remote OR <Preferred Metro>) after:YYYY-MM-DD`
- `"<Target Title>" (<Boost Stack> OR <Boost Stack>) Remote`
- `site:boards.greenhouse.io "<Target Title>" <Boost Stack>`
- `site:jobs.ashbyhq.com "<Target Title>" OR "<Peer Title>"`
- `site:jobs.lever.co "<Target Title>" OR "<Peer Title>" <Boost Stack>`
- `site:myworkdayjobs.com "<Target Title>" OR "<Peer Title>"`
- `site:jobs.smartrecruiters.com "<Target Title>"`
- `site:apply.workable.com "<Target Title>" <Boost Stack>`
- `site:remoteok.com "<Target Title>" OR "Senior" (<Boost Stack>)`
- `site:weworkremotely.com "<Target Title>" <Boost Stack>`
- `site:himalayas.app "<Target Title>" <Boost Stack>`
- `site:dice.com "<Target Title>" <Boost Stack> Remote`
- `site:trueup.io "<Target Title>" <Boost Stack>`
- `site:news.ycombinator.com "Who is hiring" (<Target Title> OR <Boost Stack>)`

## Query packs (run several)

Build packs from candidate.md. Example shape (replace with the candidate’s targets):

1. Primary target titles — boost stacks — remote / preferred metro
2. Secondary target titles — boost stacks
3. Management / lead titles if listed in candidate.md
4. Platform / domain variants that match experience anchors
5. Tech lead / peer titles from candidate.md

**Do not** run specialist query packs for **Deprioritize** stacks unless the user asks. If a hit is deprioritize-stack-primary, apply [candidate.md](candidate.md) deprioritization and [ranking.md](ranking.md) stack penalties rather than promoting it.

## Recency

Default window: **30 days**. Resolve the window each run as: **user override this turn → saved `search.recency` from `leads/index.json` → `30d`**. Write the resolved value back to `search.recency` so it persists until the user changes it again.

| User says | Window |
|-----------|--------|
| (default / unset) | 30 days (`30d`) |
| 1 hour / last hour | 1 hour (`1h`) |
| today / 24h / 1 day | 24 hours (`1d`) |
| 3 days | 3 days (`3d`) |
| 1 week / past week | 7 days (`1w`) |
| 2 weeks | 14 days (`2w`) |
| 30 days / past month | 30 days (`30d`) |

When the board only supports day-level filters, pull the nearest supported bucket then discard items older than the resolved window when timestamps exist.

**Addition bias:** among qualifying hits, prefer the most recent `posted_at` when deciding what enters a near-full cache. Always prioritize fresher posts over older ones inside the window.

## Deduping

Key on canonical company career URL when possible; else `(company normalized) + (title normalized)`. Prefer the ATS link over LinkedIn/Indeed mirrors in the saved `url` field and as primary `source`.

Always record **every** board where the role appeared in `sources` (e.g. `["linkedin", "greenhouse"]`). Never replace LinkedIn/Indeed with only the ATS — keep aggregators in `sources` even when the URL points at Greenhouse/Lever/Ashby. On merge, union sources. Optionally keep aggregator URLs in posting notes.
