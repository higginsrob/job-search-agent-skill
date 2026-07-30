# Fraud & misleading listing checks

Investigate each **new or updated** lead before saving (and any lead whose JD/URL changed). Goal: flag risk — not certify safety.

## Flags

| Flag | Meaning |
|------|---------|
| `clear` | Company and posting look consistent; no major red flags found |
| `caution` | Something odd (thin JD, odd channel, mismatched location) — proceed carefully |
| `suspicious` | Multiple scam/misleading patterns — do not prioritize applying |

## Checklist (quick)

For every lead, attempt:

1. **Company exists** — real website, LinkedIn company page, or known employer
2. **Posting source** — prefer careers/ATS; be wary of only-Telegram / only-WhatsApp apply
3. **Contact channel** — no “email us your SSN / bank details to start”; no personal Gmail-only for large brands
4. **JD coherence** — salary/title/seniority align; not “Staff Eng” with 1 year experience and crypto faucet duties
5. **Duplicate bait** — same text reused across unrelated “companies”
6. **Domain spoof** — careers URL domain matches company (watch lookalike domains)
7. **Recruiter clarity** — third-party OK if agency named; flag anonymous “client in stealth” with pressure tactics
8. **Comp bait** — absurd pay for vague work → `caution` or `suspicious`
9. **Interview process tells** — unpaid “trial projects” that sound like free labor farms → `caution`
10. **Recency authenticity** — “posted 1h ago” but every field looks scraped/stale → note it

## Notes format

`fraud_notes` is a string array of short evidence lines, e.g.:

```json
"fraud_notes": [
  "Only apply path is WhatsApp number on a non-company domain",
  "Company site is a 1-page parked domain registered recently"
]
```

Empty array when `clear`.

## Reporting

Always show the flag next to the rank in the user summary (at least for top ranks and any non-`clear` flags on the board). Keep suspicious jobs ranked on the board — call them out explicitly; do not delete them or silently drop them (mark dead only if the user asks).
