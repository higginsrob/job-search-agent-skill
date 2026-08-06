#!/usr/bin/env python3
"""Merge-safe Lead Finder target add / orphan sync.

Never rewrite scout/targets.json from a stale full snapshot — use this script
(or POST /api/scout/targets) so concurrent /job-scout runs cannot drop companies.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCOUT = ROOT / "scout"
TARGETS = SCOUT / "targets.json"
TARGETS_EXAMPLE = SCOUT / "targets.example.json"

KNOWN_DOMAINS = {
    "cursor": "cursor.com",
    "databricks": "databricks.com",
    "github": "github.com",
    "google": "google.com",
    "linear": "linear.app",
    "meta": "meta.com",
    "netflix": "netflix.com",
    "notion": "notion.com",
    "reddit": "reddit.com",
    "supabase": "supabase.com",
    "vercel": "vercel.com",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def company_slug(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return s[:80] or "company"


def ensure_targets_file() -> None:
    SCOUT.mkdir(parents=True, exist_ok=True)
    if TARGETS.exists():
        return
    if TARGETS_EXAMPLE.exists():
        TARGETS.write_text(TARGETS_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        TARGETS.write_text(
            json.dumps({"updated_at": None, "companies": []}, indent=2) + "\n",
            encoding="utf-8",
        )


def read_targets() -> dict:
    ensure_targets_file()
    try:
        data = json.loads(TARGETS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {"updated_at": None, "companies": []}
    companies = data.get("companies") if isinstance(data.get("companies"), list) else []
    clean: list[dict] = []
    seen: set[str] = set()
    for item in companies:
        if not isinstance(item, dict):
            continue
        slug = company_slug(str(item.get("slug") or item.get("name") or ""))
        if not slug or slug in seen:
            continue
        seen.add(slug)
        clean.append(
            {
                "slug": slug,
                "name": str(item.get("name") or slug).strip() or slug,
                "domain": (str(item.get("domain") or "").strip() or None),
                "added_at": item.get("added_at"),
                "notes": str(item.get("notes") or ""),
            }
        )
    return {"updated_at": data.get("updated_at"), "companies": clean}


def write_targets(companies: list[dict]) -> dict:
    payload = {"updated_at": utc_now(), "companies": companies}
    TARGETS.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def upsert_company(
    companies: list[dict],
    *,
    name: str,
    slug: str | None = None,
    domain: str | None = None,
    notes: str = "",
    added_at: str | None = None,
) -> tuple[list[dict], bool]:
    """Return (companies, created). Updates name/domain/notes on existing slug."""
    safe = company_slug(slug or name)
    domain = (domain or "").strip() or KNOWN_DOMAINS.get(safe)
    existing = next((c for c in companies if c["slug"] == safe), None)
    if existing:
        existing["name"] = name.strip() or existing["name"]
        if domain:
            existing["domain"] = domain
        if notes:
            existing["notes"] = notes
        return companies, False
    companies.append(
        {
            "slug": safe,
            "name": name.strip() or safe,
            "domain": domain,
            "added_at": added_at or utc_now(),
            "notes": notes or "",
        }
    )
    return companies, True


def sync_orphans(companies: list[dict]) -> tuple[list[dict], list[str]]:
    """Add any scout/<slug>/scout.json not already on the targets list."""
    added: list[str] = []
    if not SCOUT.is_dir():
        return companies, added
    for folder in sorted(SCOUT.iterdir()):
        if not folder.is_dir():
            continue
        scout_path = folder / "scout.json"
        if not scout_path.is_file():
            continue
        slug = company_slug(folder.name)
        try:
            scout = json.loads(scout_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            scout = {}
        name = str(scout.get("company") or slug)
        companies, created = upsert_company(
            companies,
            name=name,
            slug=slug,
            domain=KNOWN_DOMAINS.get(slug),
            added_at=scout.get("updated_at") or utc_now(),
        )
        if created:
            added.append(slug)
    return companies, added


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", nargs="?", help="Company name to add")
    parser.add_argument("--slug", help="Override slug")
    parser.add_argument("--domain", help="Company domain")
    parser.add_argument("--notes", default="", help="Optional notes")
    parser.add_argument(
        "--sync-orphans",
        action="store_true",
        help="Add every scout/*/scout.json missing from targets.json",
    )
    args = parser.parse_args()

    if not args.name and not args.sync_orphans:
        parser.error("provide a company name and/or --sync-orphans")

    data = read_targets()
    companies = list(data["companies"])
    created_slugs: list[str] = []

    if args.name:
        companies, created = upsert_company(
            companies,
            name=args.name,
            slug=args.slug,
            domain=args.domain,
            notes=args.notes,
        )
        slug = company_slug(args.slug or args.name)
        if created:
            created_slugs.append(slug)
        else:
            print(f"updated existing target: {slug}", file=sys.stderr)

    if args.sync_orphans:
        companies, orphan_slugs = sync_orphans(companies)
        created_slugs.extend(orphan_slugs)

    # Stable sort by name for readable UI
    companies.sort(key=lambda c: str(c.get("name") or c.get("slug") or "").lower())
    write_targets(companies)

    if created_slugs:
        print("added: " + ", ".join(created_slugs))
    else:
        print("no new targets (already present or nothing to sync)")
    print(f"total: {len(companies)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
