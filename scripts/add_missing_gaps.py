#!/usr/bin/env python3
"""Add missing_gaps to lead meta.json and posting.md files."""

import json
import re
from pathlib import Path

LEADS_DIR = Path(__file__).resolve().parent.parent / "leads"

# Curated gaps per lead id (0-5 short strings; [] when none)
GAPS: dict[str, list[str]] = {
    "20260730-1810-affirm-senior-full-stack-zt1-labs": [
        "TypeScript/Node not emphasized in public JD vs boost stack",
    ],
    "20260730-1810-affirm-senior-fullstack-card-acquisition": [],
    "20260730-1810-coinbase-senior-swe-frontend-agentic-trading": [
        "Frontend-primary scope vs full-stack/platform background",
        "Crypto/agentic trading domain not evidenced on resume",
    ],
    "20260730-1810-digible-staff-software-engineer": [],
    "20260730-1810-dropbox-senior-fullstack-web-experience": [],
    "20260730-1810-fivetran-principal-swe-ai-tooling": [
        "Oakland AMER onsite — remote flexibility unclear vs Denver",
    ],
    "20260730-1810-fivetran-senior-staff-software-engineer": [
        "Data infra/connector focus over TS/React product fullstack",
        "Remote tied to New York AMER — verify CO eligibility",
    ],
    "20260730-1810-gusto-staff-software-engineer-business-money": [],
    "20260730-1810-harvey-staff-swe-agents-nyc": [
        "NYC onsite required vs Denver/remote preference",
        "Legal-tech vertical not evidenced on resume",
    ],
    "20260730-1810-instacart-senior-em-enterprise-fulfillment": [
        "Enterprise fulfillment/logistics domain vs AI/platform background",
    ],
    "20260730-1810-launchdarkly-em-experimentation": [
        "Experimentation/feature-flags product domain depth",
    ],
    "20260730-1810-luxury-presence-em-maps-search": [
        "Maps & geo-search domain experience",
    ],
    "20260730-1810-luxury-presence-staff-swe-ai-marketing": [],
    "20260730-1810-mercury-senior-full-stack-engineer": [],
    "20260730-1810-mercury-staff-swe-fraud": [
        "Fraud/risk ML decisioning systems experience",
    ],
    "20260730-1810-owner-applied-ai-lead": [
        "Comp/title band below staff/HoE experience level",
        "Restaurant/hospitality vertical not evidenced on resume",
    ],
    "20260730-1810-pinterest-staff-swe-ai-tools": [],
    "20260730-1810-reddit-em-advanced-signals": [
        "Signals/ML ranking domain vs fullstack/platform anchors",
    ],
    "20260730-1810-reddit-senior-swe-core-platform": [
        "Python-primary platform role vs TS/React boost stack",
    ],
    "20260730-1810-reddit-staff-ads-business-manager": [],
    "20260730-1810-twilio-principal-software-engineer": [
        "Python/infra-primary day-to-day vs TS/React fullstack",
    ],
    "20260730-1810-twilio-tech-lead-applied-research": [],
}


def gaps_section_body(gaps: list[str]) -> str:
    if not gaps:
        return "None — no material gaps vs profile."
    return "\n".join(f"- {g}" for g in gaps)


def update_posting(posting_path: Path, gaps: list[str]) -> bool:
    if not posting_path.exists():
        return False
    text = posting_path.read_text(encoding="utf-8")
    if "## Missing gaps" in text:
        return False

    body = gaps_section_body(gaps)
    section = f"## Missing gaps\n\n{body}\n"

    if re.search(r"^## Why it fits\s*$", text, re.MULTILINE):
        text = re.sub(
            r"(^## Why it fits\s*\n(?:.*?\n)*?)(?=^## )",
            lambda m: m.group(1).rstrip() + "\n\n" + section + "\n",
            text,
            count=1,
            flags=re.MULTILINE,
        )
    elif re.search(r"^## Fraud notes\s*$", text, re.MULTILINE):
        text = re.sub(
            r"(?=^## Fraud notes\s*$)",
            section + "\n",
            text,
            count=1,
            flags=re.MULTILINE,
        )
    else:
        text = text.rstrip() + "\n\n" + section

    posting_path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    updated: list[tuple[str, list[str]]] = []
    skipped: list[str] = []

    for lead_dir in sorted(LEADS_DIR.iterdir()):
        if not lead_dir.is_dir():
            continue
        meta_path = lead_dir / "meta.json"
        if not meta_path.exists():
            continue

        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        lead_id = meta.get("id", lead_dir.name)

        if "missing_gaps" in meta:
            skipped.append(lead_id)
            continue

        gaps = GAPS.get(lead_id)
        if gaps is None:
            print(f"WARNING: no gaps defined for {lead_id}")
            gaps = []

        meta["missing_gaps"] = gaps
        meta_path.write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        update_posting(lead_dir / "posting.md", gaps)
        updated.append((lead_id, gaps))

    print(f"Updated: {len(updated)}")
    print(f"Skipped (already had missing_gaps): {len(skipped)}")
    for lead_id, gaps in updated:
        print(f"  {lead_id}: {json.dumps(gaps)}")


if __name__ == "__main__":
    main()
