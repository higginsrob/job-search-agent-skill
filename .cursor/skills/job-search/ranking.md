# Hire-likelihood ranking

Rank by **how likely this candidate is to get the job** — not by how prestigious the company is alone. Use [candidate.md](candidate.md) for targets, stack preferences, and experience anchors.

`hire_likelihood` is an integer **0–100**. Assign a score to every saved lead. Persist up to **100** leads on the board, each with a continuous `rank` (1 = highest hire likelihood). Chat summaries may highlight the top 10–20.

## Score components

| Component | Weight | What to reward |
|-----------|--------|----------------|
| Title & scope match | 30 | Titles and scope from candidate.md target roles; clear ownership |
| Skills & stack overlap | 25 | **Boost stacks first** (per candidate.md); exact boost-stack match beats polyglot “any backend” |
| Level & bar alignment | 15 | Level the candidate can clear per candidate.md; not over-leveled unless evidence fits |
| Company & role credibility | 10 | Real product, clear team, coherent JD |
| Location / remote fit | 10 | Location / remote prefs from candidate.md |
| Freshness & apply advantage | 10 | Newer posts score higher within the window (first-mover). Strongly prefer `NEW 1h`/`NEW 1d` over `3d`/`1w`/`2w`/`30d` when scores are close |

### Stack scoring rules (within the 25)

- **High:** Candidate **Boost** stacks are required or clearly primary
- **Medium:** Boost stacks present alongside other backends; or strong domain fit with related services
- **Low:** JD identity is a **Deprioritize** stack even if title otherwise fits — capable ≠ target
- Incidental deprioritized-language bullets do not force a low score if a boost stack is still the job’s center of gravity

Subtract for: vague JD, title inflation with junior scope, missing stack, extreme domain mismatch, **deprioritize-primary specialist JDs** (−8 to −20 on stack overlap), heavy on-site outside preferred locations with no remote, `caution`/`suspicious` fraud flags (−5 to −25), missing compensation when peers list bands (−0; still save with `compensation: null`).

**Cache admission (near capacity):** prefer boost-stack-primary roles over deprioritize-stack-primary roles at similar hire-likelihood. If hire-likelihood is within ~5 points, admit/keep the newer `posted_at`. Do not keep an unprotected 20-day-old mid score over a same-day strong match.

## Target bucket labels

Assign one that matches candidate.md (examples):

- `staff-engineer`
- `senior-fullstack`
- `ai-eng-manager`
- `similar`

## Fit summary

One sentence tying the candidate’s **experience anchors** from candidate.md to the JD’s needs.

## Missing gaps

Also write `missing_gaps` (0–5 short strings) for required/important JD items not evidenced on the profile. Material gaps should already be reflected in `hire_likelihood` — the list explains the score; it is not a second score.

## Output order

1. Sort by `hire_likelihood` desc  
2. Tie-break: better title match → clearer URL/ATS → newer `posted_at`
3. Set `rank` = 1..N in that order for **all** retained leads (no `rank: null` overflow)
