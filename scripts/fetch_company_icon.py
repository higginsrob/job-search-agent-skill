#!/usr/bin/env python3
"""Fetch a company icon into companies/<slug>/ and record it on brief.json.

Usage:
  python3 scripts/fetch_company_icon.py                 # all companies with briefs
  python3 scripts/fetch_company_icon.py pinterest dropbox
  python3 scripts/fetch_company_icon.py --domain pinterest.com pinterest
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
COMPANIES = ROOT / "companies"

ICON_BASENAME = "icon"
USER_AGENT = "job-research-icon-fetch/1.0 (+local research board)"

# Hosts that are rarely the company's own brand domain.
SKIP_HOST_RE = re.compile(
    r"(?i)(^|\.)("
    r"wikipedia\.org|wikimedia\.org|techcrunch\.com|theverge\.com|"
    r"businesswire\.com|sec\.gov|fool\.com|stocktitan\.net|"
    r"globeandmail\.com|linkedin\.com|indeed\.com|levels\.fyi|"
    r"builtin\.com|dice\.com|greenhouse\.io|lever\.co|ashbyhq\.com|"
    r"workday\.com|smartrecruiters\.com|myworkdayjobs\.com|"
    r"q4cdn\.com|cloudfront\.net|googleusercontent\.com|"
    r"youtube\.com|twitter\.com|x\.com|facebook\.com|"
    r"crunchbase\.com|pitchbook\.com|bloomberg\.com|reuters\.com|"
    r"nytimes\.com|wsj\.com|forbes\.com|businessinsider\.com"
    r")$"
)

EXT_BY_TYPE = {
    "image/png": ".png",
    "image/x-png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/gif": ".gif",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
    "image/ico": ".ico",
}

MAGIC_EXT = (
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"\xff\xd8\xff", ".jpg"),
    (b"RIFF", ".webp"),  # checked further below
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
    (b"<svg", ".svg"),
    (b"<?xml", ".svg"),
)


def load_brief(folder: Path) -> dict | None:
    path = folder / "brief.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def save_brief(folder: Path, brief: dict) -> None:
    path = folder / "brief.json"
    path.write_text(json.dumps(brief, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def registrable_hint(host: str) -> str:
    host = host.lower().removeprefix("www.")
    parts = host.split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return host


def domain_from_sources(sources: list, slug: str) -> str | None:
    slug_compact = re.sub(r"[^a-z0-9]", "", slug.lower())
    candidates: list[tuple[int, str]] = []
    for raw in sources or []:
        try:
            host = urlparse(str(raw)).hostname or ""
        except ValueError:
            continue
        host = host.lower()
        if not host or SKIP_HOST_RE.search(host):
            continue
        hint = registrable_hint(host)
        score = 0
        compact = re.sub(r"[^a-z0-9]", "", hint)
        if slug_compact and slug_compact in compact:
            score += 10
        if host.startswith("www."):
            score += 1
        if any(
            x in host
            for x in ("careers", "jobs", "about", "newsroom", "investor")
        ):
            score -= 1
        candidates.append((score, hint))
    if not candidates:
        return None
    candidates.sort(key=lambda x: (-x[0], len(x[1]), x[1]))
    return candidates[0][1]


def guess_domain(slug: str, brief: dict | None, override: str | None) -> str | None:
    if override:
        return override.lower().removeprefix("www.")
    if brief:
        existing = brief.get("domain")
        if isinstance(existing, str) and existing.strip():
            return existing.strip().lower().removeprefix("www.")
        from_sources = domain_from_sources(brief.get("sources") or [], slug)
        if from_sources:
            return from_sources
    # Last resort: slug.com (often wrong for .ai / multi-word, but cheap to try)
    compact = slug.replace("-", "")
    if compact:
        return f"{compact}.com"
    return None


def detect_ext(data: bytes, content_type: str | None) -> str:
    ctype = (content_type or "").split(";")[0].strip().lower()
    if ctype in EXT_BY_TYPE:
        return EXT_BY_TYPE[ctype]
    for magic, ext in MAGIC_EXT:
        if data.startswith(magic):
            if ext == ".webp" and b"WEBP" not in data[:16]:
                continue
            return ext
    if data[:4] == b"\x00\x00\x01\x00" or data[:4] == b"\x00\x00\x02\x00":
        return ".ico"
    return ".png"


def fetch_url(url: str, timeout: float = 20.0) -> tuple[bytes, str | None]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        ctype = resp.headers.get("Content-Type")
        return data, ctype


def icon_candidates(domain: str) -> list[str]:
    return [
        f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
        f"https://logo.clearbit.com/{domain}",
        f"https://www.{domain}/favicon.ico",
        f"https://{domain}/favicon.ico",
        f"https://www.{domain}/apple-touch-icon.png",
        f"https://{domain}/apple-touch-icon.png",
    ]


def clear_existing_icons(folder: Path) -> None:
    for path in folder.glob("icon.*"):
        if path.is_file():
            path.unlink()


def fetch_icon_for_folder(
    folder: Path,
    *,
    domain_override: str | None = None,
    force: bool = False,
) -> tuple[bool, str]:
    slug = folder.name
    brief = load_brief(folder)
    if brief is None:
        return False, f"{slug}: no brief.json"

    existing_icon = brief.get("icon")
    if (
        not force
        and isinstance(existing_icon, str)
        and existing_icon.strip()
        and (folder / existing_icon.strip()).is_file()
    ):
        return True, f"{slug}: kept existing {existing_icon}"

    domain = guess_domain(slug, brief, domain_override)
    if not domain:
        return False, f"{slug}: could not resolve domain"

    last_err = "no candidates succeeded"
    for url in icon_candidates(domain):
        try:
            data, ctype = fetch_url(url)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            last_err = str(exc)
            continue
        if not data or len(data) < 64:
            last_err = f"too small from {url}"
            continue
        # Google sometimes returns a 16x16 default globe; still usable as fallback.
        ext = detect_ext(data, ctype)
        if ext == ".svg" and b"<svg" not in data[:200].lower() and b"<?xml" not in data[:200].lower():
            last_err = f"non-svg from {url}"
            continue
        filename = f"{ICON_BASENAME}{ext}"
        clear_existing_icons(folder)
        (folder / filename).write_bytes(data)
        brief["domain"] = domain
        brief["icon"] = filename
        save_brief(folder, brief)
        return True, f"{slug}: wrote {filename} ({domain} via {urlparse(url).hostname})"

    return False, f"{slug}: failed ({domain}): {last_err}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "slugs",
        nargs="*",
        help="Company slugs (default: all folders with brief.json)",
    )
    parser.add_argument(
        "--domain",
        help="Force domain when fetching a single slug",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even when an icon already exists",
    )
    args = parser.parse_args()

    if args.domain and len(args.slugs) != 1:
        print("--domain requires exactly one slug", file=sys.stderr)
        return 2

    if args.slugs:
        folders = [COMPANIES / slug for slug in args.slugs]
    else:
        folders = sorted(
            p for p in COMPANIES.iterdir() if p.is_dir() and (p / "brief.json").is_file()
        )

    ok = 0
    for folder in folders:
        if not folder.is_dir():
            print(f"{folder.name}: missing folder", file=sys.stderr)
            continue
        success, message = fetch_icon_for_folder(
            folder, domain_override=args.domain, force=args.force
        )
        print(message)
        if success:
            ok += 1

    print(f"Done: {ok}/{len(folders)} icons ready")
    return 0 if ok == len(folders) else 1


if __name__ == "__main__":
    raise SystemExit(main())
