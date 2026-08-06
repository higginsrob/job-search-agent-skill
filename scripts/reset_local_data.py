#!/usr/bin/env python3
"""Reset local job-search data: leads, companies, scout, recruiters, and candidate profile settings.

Usage (from repo root):
  make reset
  # or: python3 scripts/reset_local_data.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ANSI
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
YEL = "\033[93m"
MAG = "\033[95m"
CYA = "\033[96m"
WHT = "\033[97m"
RST = "\033[0m"
BG_RED = "\033[41m"
BG_YEL = "\033[43m"
BG_BLK = "\033[40m"


def c(code: str, text: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"{code}{text}{RST}"


def banner() -> None:
    width = 64
    bar = "█" * width
    print()
    print(c(BG_RED + BOLD + WHT, bar))
    print(c(BG_RED + BOLD + WHT, "  ⚠  DANGER  ·  DESTRUCTIVE RESET  ·  NO UNDO  ".ljust(width)))
    print(c(BG_RED + BOLD + WHT, bar))
    print()
    print(c(BOLD + YEL, "  This will permanently wipe your local job-search state."))
    print(c(BOLD + YEL, "  There is no recycle bin. Gone means gone."))
    print()
    print(c(BOLD + MAG, "  What will be deleted"))
    print(c(RED, "  ────────────────────────────────────────────────────────────"))
    print(c(CYA, "  • Job history") + c(DIM, "          leads/*  (all saved openings, ranks, notes)"))
    print(c(CYA, "  • Company briefs") + c(DIM, "       companies/*"))
    print(c(CYA, "  • Lead Finder") + c(DIM, "          scout/*  (targets, findings, HMs, signals)"))
    print(c(CYA, "  • Recruiters") + c(DIM, "           recruiters/*"))
    print(c(CYA, "  • Candidate profile") + c(DIM, "    .cursor/skills/job-search/candidate.md"))
    print(c(CYA, "  • Base resume draft") + c(DIM, "   .cursor/skills/job-generate-resume/base-resume.md"))
    print(c(CYA, "  • Search settings") + c(DIM, "       persisted window / last-search metadata"))
    print()
    print(c(BOLD + MAG, "  What will be kept"))
    print(c(RED, "  ────────────────────────────────────────────────────────────"))
    print(c(WHT, "  • Your resume files") + c(DIM, "     resume/*"))
    print(c(WHT, "  • Skills + board UI") + c(DIM, "     .cursor/skills, index.html, assets/"))
    print(c(WHT, "  • Example stubs") + c(DIM, "         *.example.md, *.example.json"))
    print()
    print(c(BG_YEL + BOLD + BG_BLK, "  After reset you will need to re-run /job-search or             "))
    print(c(BG_YEL + BOLD + BG_BLK, "  /job-sync-resume to rebuild candidate.md and start a       "))
    print(c(BG_YEL + BOLD + BG_BLK, "  fresh leads board.                                          "))
    print()


def confirm() -> bool:
    print(c(BOLD + RED, '  Type RESET (all caps) to continue, or anything else to abort.'))
    print()
    try:
        answer = input(c(BOLD + YEL, "  > ")).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    return answer == "RESET"


def wipe_dir_contents(path: Path, keep_names: set[str]) -> list[str]:
    removed: list[str] = []
    if not path.is_dir():
        path.mkdir(parents=True, exist_ok=True)
        return removed
    for child in path.iterdir():
        if child.name in keep_names:
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
        removed.append(str(child.relative_to(ROOT)))
    return removed


def restore_leads_index() -> None:
    leads = ROOT / "leads"
    leads.mkdir(parents=True, exist_ok=True)
    example = leads / "index.example.json"
    target = leads / "index.json"
    if example.is_file():
        target.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        target.write_text(
            '{\n  "updated_at": null,\n  "leads": []\n}\n',
            encoding="utf-8",
        )


def restore_scout_targets() -> None:
    scout = ROOT / "scout"
    scout.mkdir(parents=True, exist_ok=True)
    example = scout / "targets.example.json"
    target = scout / "targets.json"
    if example.is_file():
        target.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        target.write_text(
            '{\n  "updated_at": null,\n  "companies": []\n}\n',
            encoding="utf-8",
        )


def restore_recruiters_index() -> None:
    recruiters = ROOT / "recruiters"
    recruiters.mkdir(parents=True, exist_ok=True)
    example = recruiters / "index.example.json"
    target = recruiters / "index.json"
    if example.is_file():
        target.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        target.write_text(
            '{\n  "updated_at": null,\n  "recruiters": []\n}\n',
            encoding="utf-8",
        )


def remove_file(path: Path) -> str | None:
    if path.is_file():
        path.unlink()
        return str(path.relative_to(ROOT))
    return None


def main() -> int:
    banner()
    if not confirm():
        print(c(BOLD + CYA, "  Aborted. Nothing was deleted."))
        print()
        return 1

    print()
    print(c(BOLD + YEL, "  Resetting…"))
    removed: list[str] = []
    removed.extend(
        wipe_dir_contents(
            ROOT / "leads",
            {".gitkeep", "index.example.json", "sources.example.json"},
        )
    )
    removed.extend(wipe_dir_contents(ROOT / "companies", {".gitkeep"}))
    removed.extend(
        wipe_dir_contents(
            ROOT / "scout",
            {".gitkeep", "targets.example.json", "scout.example.json"},
        )
    )
    removed.extend(
        wipe_dir_contents(
            ROOT / "recruiters",
            {".gitkeep", "index.example.json", "meta.example.json"},
        )
    )

    for rel in (
        ".cursor/skills/job-search/candidate.md",
        ".cursor/skills/job-generate-resume/base-resume.md",
    ):
        hit = remove_file(ROOT / rel)
        if hit:
            removed.append(hit)

    restore_leads_index()
    removed.append("leads/index.json (restored empty from example)")
    restore_scout_targets()
    removed.append("scout/targets.json (restored empty from example)")
    restore_recruiters_index()
    removed.append("recruiters/index.json (restored empty from example)")

    print(c(BOLD + RED, f"  Removed {len(removed)} path(s)."))
    for item in removed[:40]:
        print(c(DIM, f"    - {item}"))
    if len(removed) > 40:
        print(c(DIM, f"    … and {len(removed) - 40} more"))
    print()
    print(c(BOLD + CYA, "  Done. Local job history and candidate settings are cleared."))
    print(c(DIM, "  Next: add/confirm resume/, then run /job-sync-resume or /job-search."))
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
