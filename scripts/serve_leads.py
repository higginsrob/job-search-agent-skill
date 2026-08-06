#!/usr/bin/env python3
"""Serve the job leads board with set-status / applied / mark-dead / delete API.

Also serves Lead Finder (scout) and Recruiters APIs.

Delete removes the lead folder + index entry, but refuses when the lead has
been marked applied (application history must be retained; use mark_dead).

Usage (from repo root):
  make server
  # or: python3 scripts/serve_leads.py
  # → http://127.0.0.1:8765
"""

from __future__ import annotations

import json
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
LEADS = ROOT / "leads"
COMPANIES = ROOT / "companies"
SCOUT = ROOT / "scout"
RECRUITERS = ROOT / "recruiters"
INDEX = LEADS / "index.json"
SOURCES_FILE = LEADS / "sources.json"
SOURCES_EXAMPLE = LEADS / "sources.example.json"
SCOUT_TARGETS = SCOUT / "targets.json"
SCOUT_TARGETS_EXAMPLE = SCOUT / "targets.example.json"
RECRUITERS_INDEX = RECRUITERS / "index.json"
RECRUITERS_INDEX_EXAMPLE = RECRUITERS / "index.example.json"
HOST = "127.0.0.1"
PORT = 8765
VALID_STATUSES = frozenset(
    {"active", "in_progress", "applied", "interview", "dead"}
)
RECRUITER_STATUSES = frozenset({"found", "contacted", "dead"})

# Keep in sync with sites.md / assets/app.js SOURCE_CATALOG
SOURCE_CATALOG = [
    {"id": "linkedin", "label": "LinkedIn Jobs", "group": "Aggregators"},
    {"id": "indeed", "label": "Indeed", "group": "Aggregators"},
    {"id": "google-jobs", "label": "Google Jobs", "group": "Aggregators"},
    {"id": "trueup", "label": "TrueUp", "group": "Aggregators"},
    {"id": "levels", "label": "Levels.fyi Jobs", "group": "Aggregators"},
    {"id": "dice", "label": "Dice", "group": "Aggregators"},
    {"id": "greenhouse", "label": "Greenhouse", "group": "ATS"},
    {"id": "lever", "label": "Lever", "group": "ATS"},
    {"id": "ashby", "label": "Ashby", "group": "ATS"},
    {"id": "workday", "label": "Workday", "group": "ATS"},
    {"id": "smartrecruiters", "label": "SmartRecruiters", "group": "ATS"},
    {"id": "workable", "label": "Workable", "group": "ATS"},
    {"id": "company", "label": "Company career pages", "group": "ATS"},
    {"id": "remoteok", "label": "RemoteOK", "group": "Remote"},
    {"id": "weworkremotely", "label": "We Work Remotely", "group": "Remote"},
    {"id": "himalayas", "label": "Himalayas", "group": "Remote"},
    {"id": "wellfound", "label": "Wellfound", "group": "Startup / community"},
    {"id": "yc", "label": "YC Work at a Startup", "group": "Startup / community"},
    {"id": "otta", "label": "Otta / Welcome to the Jungle", "group": "Startup / community"},
    {"id": "builtin", "label": "Built In", "group": "Startup / community"},
    {"id": "hackernews", "label": "HN Who’s Hiring", "group": "Startup / community"},
    {"id": "scout", "label": "Lead Finder (scout)", "group": "Outreach"},
]
SOURCE_IDS = frozenset(item["id"] for item in SOURCE_CATALOG)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def company_slug(name: str) -> str:
    """Lowercase ASCII kebab — keep in sync with assets/app.js companySlug."""
    text = unicodedata.normalize("NFKD", str(name or ""))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "company"


def kebab_fragment(text: str, max_len: int = 40) -> str:
    slug = company_slug(text)
    return slug[:max_len].rstrip("-") or "role"


def normalize_interviews(raw) -> list[dict]:
    """Validate and normalize an interviews array for meta / manifest."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("interviews must be a list")
    out: list[dict] = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"interviews[{i}] must be an object")
        at = item.get("at")
        if at is None or str(at).strip() == "":
            raise ValueError(f"interviews[{i}].at is required")
        at_s = str(at).strip()
        # Light ISO check — accept offset or Z; datetime-local from UI is fine
        try:
            datetime.fromisoformat(at_s.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"interviews[{i}].at must be ISO datetime") from exc
        iv_id = str(item.get("id") or "").strip()
        if not iv_id:
            stamp = utc_now().replace(":", "").replace("-", "")[:15]
            iv_id = f"iv-{stamp}-{i:02d}"
        out.append(
            {
                "id": iv_id,
                "at": at_s,
                "label": str(item.get("label") or "").strip(),
                "notes": str(item.get("notes") or "").strip(),
            }
        )
    return out


def apply_status_side_effects(
    meta: dict,
    status: str,
    *,
    applied_at: str | None = None,
    dead_reason: str | None = None,
) -> None:
    """Sync status with optional applied history.

    Applied / applied_at are set when entering the Applied lane and preserved
    when moving to Interview or Dead (application tracking). Leaving for
    Active / In progress clears them. Applied leads cannot be hard-deleted.
    """
    meta["status"] = status
    if status == "applied":
        meta["applied"] = True
        meta["applied_at"] = applied_at or meta.get("applied_at") or utc_now()
        meta["dead_reason"] = None
    elif status in ("interview", "dead"):
        # Keep applied history for tracking across later swim lanes
        meta["dead_reason"] = dead_reason if status == "dead" else None
    else:
        meta["applied"] = False
        meta["applied_at"] = None
        meta["dead_reason"] = None


def ensure_sources_file() -> None:
    LEADS.mkdir(parents=True, exist_ok=True)
    if SOURCES_FILE.exists():
        return
    if SOURCES_EXAMPLE.exists():
        SOURCES_FILE.write_text(SOURCES_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        write_sources({"updated_at": None, "disabled": []})


def read_sources() -> dict:
    ensure_sources_file()
    try:
        data = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {"updated_at": None, "disabled": []}
    disabled = [
        str(item).strip().lower()
        for item in (data.get("disabled") or [])
        if str(item).strip()
    ]
    # Preserve unknown ids (forward-compat) but drop empties / dupes
    seen = set()
    clean = []
    for item in disabled:
        if item in seen:
            continue
        seen.add(item)
        clean.append(item)
    return {"updated_at": data.get("updated_at"), "disabled": clean}


def write_sources(data: dict) -> dict:
    disabled = [
        str(item).strip().lower()
        for item in (data.get("disabled") or [])
        if str(item).strip()
    ]
    seen = set()
    clean = []
    for item in disabled:
        if item in seen:
            continue
        seen.add(item)
        clean.append(item)
    payload = {"updated_at": utc_now(), "disabled": clean}
    LEADS.mkdir(parents=True, exist_ok=True)
    SOURCES_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def sources_payload() -> dict:
    data = read_sources()
    disabled = set(data.get("disabled") or [])
    sources = [
        {
            **item,
            "enabled": item["id"] not in disabled,
        }
        for item in SOURCE_CATALOG
    ]
    return {
        "updated_at": data.get("updated_at"),
        "disabled": data.get("disabled") or [],
        "sources": sources,
    }


def read_index() -> dict:
    if not INDEX.exists():
        return {"updated_at": None, "leads": []}
    return json.loads(INDEX.read_text(encoding="utf-8"))


def write_index(data: dict) -> None:
    # Preserve search metadata (recency window / found_at) across lead mutations.
    previous = read_index() if INDEX.exists() else {}
    if "search" not in data and previous.get("search"):
        data["search"] = previous["search"]
    leads = data.get("leads") or []
    leads.sort(
        key=lambda item: (
            item.get("rank") is None,
            item.get("rank") if item.get("rank") is not None else 10**9,
            -(item.get("hire_likelihood") or 0),
        )
    )
    data["leads"] = leads
    data["updated_at"] = utc_now()
    INDEX.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


BOARD_CAP = 100


def lead_dir(lead_id: str) -> Path:
    # Prevent path traversal
    safe = Path(lead_id).name
    return LEADS / safe


def load_meta(lead_id: str) -> dict:
    path = lead_dir(lead_id) / "meta.json"
    return json.loads(path.read_text(encoding="utf-8"))


def save_meta(lead_id: str, meta: dict) -> None:
    path = lead_dir(lead_id) / "meta.json"
    path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def sort_leads_for_rank(metas: list[dict]) -> list[dict]:
    """Highest hire_likelihood first; continuous ranks assigned by caller."""
    return sorted(
        metas,
        key=lambda m: (
            -(m.get("hire_likelihood") or 0),
            m.get("found_at") or "",
            m.get("company") or "",
            m.get("title") or "",
        ),
    )


def sync_manifest_entry(index: dict, meta: dict) -> None:
    interviews = meta.get("interviews")
    if not isinstance(interviews, list):
        interviews = []
    entry = {
        "id": meta["id"],
        "title": meta.get("title"),
        "company": meta.get("company"),
        "rank": meta.get("rank"),
        "hire_likelihood": meta.get("hire_likelihood"),
        "fraud_flag": meta.get("fraud_flag", "clear"),
        "status": meta.get("status", "active"),
        "applied": bool(meta.get("applied", False)) or meta.get("status") == "applied",
        "applied_at": meta.get("applied_at"),
        "interested": bool(meta.get("interested", False)),
        "interested_at": meta.get("interested_at"),
        "interviews": interviews,
        "source": meta.get("source"),
        "sources": meta.get("sources") or (
            [meta["source"]] if meta.get("source") else []
        ),
        "location": meta.get("location"),
        "work_mode": meta.get("work_mode"),
        "posted_at": meta.get("posted_at"),
        "found_at": meta.get("found_at"),
        "compensation": meta.get("compensation"),
        "url": meta.get("url"),
        "path": f"leads/{meta['id']}/",
        "tags": meta.get("tags", []),
        "has_resume": bool(meta.get("has_resume", False)),
        "has_cover_letter": bool(meta.get("has_cover_letter", False)),
    }
    leads = index.setdefault("leads", [])
    for i, existing in enumerate(leads):
        if existing.get("id") == meta["id"]:
            leads[i] = entry
            break
    else:
        leads.append(entry)


# ── Scout (Lead Finder) ─────────────────────────────────────────────


def ensure_scout_targets_file() -> None:
    SCOUT.mkdir(parents=True, exist_ok=True)
    if SCOUT_TARGETS.exists():
        return
    if SCOUT_TARGETS_EXAMPLE.exists():
        SCOUT_TARGETS.write_text(
            SCOUT_TARGETS_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8"
        )
    else:
        write_scout_targets({"updated_at": None, "companies": []})


def read_scout_targets() -> dict:
    ensure_scout_targets_file()
    try:
        data = json.loads(SCOUT_TARGETS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {"updated_at": None, "companies": []}
    companies = data.get("companies") if isinstance(data.get("companies"), list) else []
    clean = []
    seen = set()
    for item in companies:
        if not isinstance(item, dict):
            continue
        slug = company_slug(item.get("slug") or item.get("name") or "")
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


def write_scout_targets(data: dict) -> dict:
    companies = data.get("companies") if isinstance(data.get("companies"), list) else []
    payload = {"updated_at": utc_now(), "companies": companies}
    SCOUT.mkdir(parents=True, exist_ok=True)
    SCOUT_TARGETS.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def scout_dir(slug: str) -> Path:
    safe = Path(company_slug(slug)).name
    return SCOUT / safe


def empty_scout(slug: str, company: str | None = None) -> dict:
    return {
        "company": company or slug,
        "slug": slug,
        "updated_at": None,
        "linkedin_company_url": None,
        "findings": [],
        "hiring_managers": [],
        "quiet_signals": [],
    }


def load_scout(slug: str) -> dict | None:
    path = scout_dir(slug) / "scout.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    data.setdefault("slug", slug)
    data.setdefault("findings", [])
    data.setdefault("hiring_managers", [])
    data.setdefault("quiet_signals", [])
    return data


def save_scout(slug: str, data: dict) -> dict:
    folder = scout_dir(slug)
    folder.mkdir(parents=True, exist_ok=True)
    data["slug"] = slug
    data["updated_at"] = data.get("updated_at") or utc_now()
    (folder / "scout.json").write_text(
        json.dumps(data, indent=2) + "\n", encoding="utf-8"
    )
    return data


def list_scout_payload() -> dict:
    targets = read_scout_targets()
    companies = targets.get("companies") or []
    scouts = []
    # Only list scouts for active targets. Orphan scout/*/ folders may remain
    # after remove (data preserved) but must not show in Lead Finder.
    for company in companies:
        slug = company.get("slug")
        if not slug:
            continue
        scout = load_scout(slug) or {}
        findings = scout.get("findings") or []
        scouts.append(
            {
                "slug": slug,
                "company": scout.get("company") or company.get("name") or slug,
                "domain": company.get("domain"),
                "updated_at": scout.get("updated_at"),
                "linkedin_company_url": scout.get("linkedin_company_url"),
                "finding_count": len(findings),
                "on_board_count": sum(
                    1 for f in findings if f.get("board_lead_id")
                ),
                "hiring_manager_count": len(scout.get("hiring_managers") or []),
                "quiet_signal_count": len(scout.get("quiet_signals") or []),
                "path": f"scout/{slug}/scout.json"
                if (SCOUT / slug / "scout.json").is_file()
                else None,
            }
        )
    return {"targets": targets, "scouts": scouts}


def next_lead_rank(index: dict) -> int:
    ranks = [
        int(item.get("rank"))
        for item in (index.get("leads") or [])
        if item.get("rank") is not None
    ]
    return (max(ranks) + 1) if ranks else 1


def promote_finding(slug: str, finding_id: str) -> dict:
    scout = load_scout(slug)
    if not scout:
        raise ValueError("scout data not found — run /job-scout first")
    findings = scout.get("findings") or []
    finding = None
    for item in findings:
        if str(item.get("id")) == str(finding_id):
            finding = item
            break
    if not finding:
        raise ValueError("finding not found")
    existing_id = finding.get("board_lead_id")
    if existing_id:
        folder = lead_dir(str(existing_id))
        if folder.is_dir():
            meta = load_meta(str(existing_id))
            if meta.get("status") == "dead":
                apply_status_side_effects(meta, "active")
                save_meta(str(existing_id), meta)
                index = read_index()
                sync_manifest_entry(index, meta)
                write_index(index)
            return {"meta": meta, "scout": scout, "revived": True}

    company = str(scout.get("company") or slug)
    title = str(finding.get("title") or "Outreach opportunity").strip()
    kind = str(finding.get("kind") or "outreach").strip().lower()
    if kind not in {"outreach", "posting"}:
        kind = "outreach"
    url = str(finding.get("url") or "").strip()
    if not url:
        raise ValueError("finding has no url to promote")

    stamp = utc_now().replace("-", "").replace(":", "")[:13]  # YYYYMMDDTHHMM
    stamp = stamp.replace("T", "-")
    lead_id = f"{stamp}-{kebab_fragment(company, 24)}-{kebab_fragment(title, 36)}"
    base_id = lead_id
    n = 2
    while lead_dir(lead_id).exists():
        lead_id = f"{base_id}-{n}"
        n += 1

    now = utc_now()
    tags = ["scout", kind]
    hire_raw = finding.get("hire_likelihood")
    try:
        hire = int(hire_raw) if hire_raw is not None else None
    except (TypeError, ValueError):
        hire = None
    if hire is None:
        hire = 65 if kind == "posting" else 58
    hire = max(0, min(100, hire))

    finding_mode = str(finding.get("work_mode") or "").strip().lower()
    lead_work_mode = {
        "remote": "remote",
        "local-office": "local-office",
        "other": "other",
        "hybrid": "hybrid",
        "hybrid-other": "hybrid",
    }.get(finding_mode, "other")
    location = finding.get("location")
    if location is not None:
        location = str(location).strip() or None
    remote = True if lead_work_mode == "remote" else (
        False if lead_work_mode in {"local-office", "other"} else None
    )

    fit_summary = (
        str(finding.get("fit_summary") or "").strip()
        or str(finding.get("summary") or "").strip()
        or f"Scout finding ({kind}) at {company}."
    )
    gaps_raw = finding.get("missing_gaps")
    missing_gaps = []
    if isinstance(gaps_raw, list):
        for g in gaps_raw[:5]:
            if isinstance(g, str) and g.strip():
                missing_gaps.append(g.strip())
    target_bucket = str(finding.get("target_bucket") or "similar").strip() or "similar"
    compensation = finding.get("compensation")
    if compensation is not None:
        compensation = str(compensation).strip() or None
    posted_at = finding.get("posted_at") or finding.get("found_at") or now

    meta = {
        "id": lead_id,
        "title": title,
        "company": company,
        "location": location,
        "remote": remote,
        "work_mode": lead_work_mode,
        "posted_at": posted_at,
        "found_at": now,
        "compensation": compensation,
        "url": url,
        "source": "scout",
        "sources": ["scout"],
        "rank": None,
        "hire_likelihood": hire,
        "fit_summary": fit_summary,
        "missing_gaps": missing_gaps,
        "target_bucket": target_bucket,
        "fraud_flag": "clear",
        "fraud_notes": [],
        "status": "active",
        "dead_reason": None,
        "applied": False,
        "applied_at": None,
        "interviews": [],
        "has_resume": False,
        "has_cover_letter": False,
        "tags": tags,
        "scout_finding_id": finding_id,
        "scout_slug": slug,
    }

    evidence = finding.get("evidence") or []
    evidence_lines = "\n".join(f"- {e}" for e in evidence) if evidence else "- (none)"
    gap_lines = (
        "\n".join(f"- {g}" for g in missing_gaps)
        if missing_gaps
        else "- None noted at promote time — refine after applying or deeper research."
    )
    role_summary = str(finding.get("summary") or "").strip() or fit_summary
    posting = (
        f"# {title}\n\n"
        f"**Company:** {company}  \n"
        f"**Source:** Lead Finder (scout) · kind `{kind}`  \n"
        f"**Hire likelihood:** {hire}/100  \n"
        f"**URL:** {url}\n\n"
        f"## Summary\n\n{role_summary}\n\n"
        f"## Why it fits\n\n{fit_summary}\n\n"
        f"## Evidence\n\n{evidence_lines}\n\n"
        f"## Missing gaps\n\n{gap_lines}\n"
    )

    folder = lead_dir(lead_id)
    folder.mkdir(parents=True, exist_ok=True)
    save_meta(lead_id, meta)
    (folder / "posting.md").write_text(posting, encoding="utf-8")

    index = read_index()
    meta["rank"] = next_lead_rank(index)
    save_meta(lead_id, meta)
    sync_manifest_entry(index, meta)
    write_index(index)

    finding["board_lead_id"] = lead_id
    save_scout(slug, scout)
    return {"meta": meta, "scout": scout, "revived": False}


def demote_finding(slug: str, finding_id: str) -> dict:
    scout = load_scout(slug)
    if not scout:
        raise ValueError("scout data not found")
    findings = scout.get("findings") or []
    finding = None
    for item in findings:
        if str(item.get("id")) == str(finding_id):
            finding = item
            break
    if not finding:
        raise ValueError("finding not found")
    lead_id = finding.get("board_lead_id")
    meta = None
    if lead_id and lead_dir(str(lead_id)).is_dir():
        meta = load_meta(str(lead_id))
        apply_status_side_effects(
            meta, "dead", dead_reason="Removed from Lead Finder"
        )
        save_meta(str(lead_id), meta)
        index = read_index()
        sync_manifest_entry(index, meta)
        write_index(index)
    finding["board_lead_id"] = None
    save_scout(slug, scout)
    return {"meta": meta, "scout": scout}


# ── Recruiters ──────────────────────────────────────────────────────


def ensure_recruiters_index() -> None:
    RECRUITERS.mkdir(parents=True, exist_ok=True)
    if RECRUITERS_INDEX.exists():
        return
    if RECRUITERS_INDEX_EXAMPLE.exists():
        RECRUITERS_INDEX.write_text(
            RECRUITERS_INDEX_EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8"
        )
    else:
        write_recruiters_index({"updated_at": None, "recruiters": []})


def read_recruiters_index() -> dict:
    ensure_recruiters_index()
    try:
        data = json.loads(RECRUITERS_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {"updated_at": None, "recruiters": []}
    if not isinstance(data.get("recruiters"), list):
        data["recruiters"] = []
    return data


def write_recruiters_index(data: dict) -> None:
    data["updated_at"] = utc_now()
    RECRUITERS.mkdir(parents=True, exist_ok=True)
    RECRUITERS_INDEX.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def recruiter_dir(recruiter_id: str) -> Path:
    safe = Path(recruiter_id).name
    return RECRUITERS / safe


def load_recruiter_meta(recruiter_id: str) -> dict:
    path = recruiter_dir(recruiter_id) / "meta.json"
    return json.loads(path.read_text(encoding="utf-8"))


def save_recruiter_meta(recruiter_id: str, meta: dict) -> None:
    folder = recruiter_dir(recruiter_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "meta.json").write_text(
        json.dumps(meta, indent=2) + "\n", encoding="utf-8"
    )


def sync_recruiter_manifest_entry(index: dict, meta: dict) -> None:
    entry = {
        "id": meta["id"],
        "name": meta.get("name"),
        "firm": meta.get("firm"),
        "linkedin_url": meta.get("linkedin_url"),
        "email": meta.get("email"),
        "focus": meta.get("focus"),
        "status": meta.get("status", "found"),
        "dead_reason": meta.get("dead_reason"),
        "found_at": meta.get("found_at"),
        "contacted_at": meta.get("contacted_at"),
        "companies": meta.get("companies") or [],
        "path": f"recruiters/{meta['id']}/",
    }
    items = index.setdefault("recruiters", [])
    for i, existing in enumerate(items):
        if existing.get("id") == meta["id"]:
            items[i] = entry
            break
    else:
        items.append(entry)


def apply_recruiter_status(
    meta: dict,
    status: str,
    *,
    dead_reason: str | None = None,
) -> None:
    meta["status"] = status
    if status == "contacted":
        meta["contacted_at"] = meta.get("contacted_at") or utc_now()
        meta["dead_reason"] = None
    elif status == "dead":
        meta["dead_reason"] = dead_reason
    else:
        meta["dead_reason"] = None


def list_recruiters_payload() -> dict:
    index = read_recruiters_index()
    # Prefer live meta when present
    items = []
    seen = set()
    for entry in index.get("recruiters") or []:
        rid = entry.get("id")
        if not rid:
            continue
        seen.add(rid)
        folder = recruiter_dir(rid)
        if (folder / "meta.json").is_file():
            try:
                meta = load_recruiter_meta(rid)
                items.append({**entry, **{
                    "name": meta.get("name"),
                    "firm": meta.get("firm"),
                    "linkedin_url": meta.get("linkedin_url"),
                    "email": meta.get("email"),
                    "focus": meta.get("focus"),
                    "notes": meta.get("notes"),
                    "status": meta.get("status", "found"),
                    "dead_reason": meta.get("dead_reason"),
                    "found_at": meta.get("found_at"),
                    "contacted_at": meta.get("contacted_at"),
                    "companies": meta.get("companies") or [],
                    "sources": meta.get("sources") or [],
                    "path": f"recruiters/{rid}/",
                }})
                continue
            except (OSError, json.JSONDecodeError):
                pass
        items.append(entry)
    if RECRUITERS.is_dir():
        for folder in sorted(RECRUITERS.iterdir()):
            if not folder.is_dir() or folder.name in seen:
                continue
            if not (folder / "meta.json").is_file():
                continue
            try:
                meta = load_recruiter_meta(folder.name)
            except (OSError, json.JSONDecodeError):
                continue
            items.append(
                {
                    "id": meta.get("id") or folder.name,
                    "name": meta.get("name"),
                    "firm": meta.get("firm"),
                    "linkedin_url": meta.get("linkedin_url"),
                    "email": meta.get("email"),
                    "focus": meta.get("focus"),
                    "notes": meta.get("notes"),
                    "status": meta.get("status", "found"),
                    "dead_reason": meta.get("dead_reason"),
                    "found_at": meta.get("found_at"),
                    "contacted_at": meta.get("contacted_at"),
                    "companies": meta.get("companies") or [],
                    "sources": meta.get("sources") or [],
                    "path": f"recruiters/{folder.name}/",
                }
            )
    return {"updated_at": index.get("updated_at"), "recruiters": items}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".txt": "text/plain; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self._json(200, {"ok": True})
        if path == "/api/candidate":
            return self._serve_candidate()
        if path == "/api/resume":
            return self._serve_resume()
        if path == "/api/companies":
            return self._serve_companies()
        if path == "/api/sources":
            return self._json(200, sources_payload())
        if path == "/api/scout/targets":
            return self._json(200, read_scout_targets())
        if path == "/api/scout":
            return self._json(200, list_scout_payload())
        if path.startswith("/api/scout/"):
            slug = company_slug(unquote(path[len("/api/scout/") :].strip("/")))
            if not slug:
                return self._json(400, {"error": "slug required"})
            scout = load_scout(slug)
            targets = read_scout_targets()
            target = next(
                (c for c in targets.get("companies") or [] if c.get("slug") == slug),
                None,
            )
            if scout is None and target is None:
                return self._json(404, {"error": "company not in Lead Finder"})
            payload = scout or empty_scout(
                slug, target.get("name") if target else slug
            )
            return self._json(
                200,
                {
                    "target": target,
                    "scout": payload,
                    "board_leads": [
                        e
                        for e in (read_index().get("leads") or [])
                        if company_slug(e.get("company") or "") == slug
                    ],
                },
            )
        if path == "/api/recruiters":
            return self._json(200, list_recruiters_payload())
        if path.startswith("/api/recruiters/"):
            rid = Path(unquote(path[len("/api/recruiters/") :].strip("/"))).name
            if not rid:
                return self._json(400, {"error": "id required"})
            folder = recruiter_dir(rid)
            if not (folder / "meta.json").is_file():
                return self._json(404, {"error": "recruiter not found"})
            try:
                meta = load_recruiter_meta(rid)
            except (OSError, json.JSONDecodeError) as exc:
                return self._json(500, {"error": str(exc)})
            return self._json(200, {"meta": meta})
        return super().do_GET()

    def _serve_companies(self) -> None:
        items = []
        if COMPANIES.is_dir():
            for folder in sorted(COMPANIES.iterdir()):
                if not folder.is_dir():
                    continue
                brief_path = folder / "brief.json"
                if not brief_path.is_file():
                    continue
                try:
                    brief = json.loads(brief_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                icon_name = brief.get("icon") if isinstance(brief.get("icon"), str) else None
                icon_path = None
                if icon_name and (folder / icon_name).is_file():
                    icon_path = f"companies/{folder.name}/{icon_name}"
                else:
                    for candidate in (
                        "icon.png",
                        "icon.webp",
                        "icon.jpg",
                        "icon.jpeg",
                        "icon.svg",
                        "icon.ico",
                        "icon.gif",
                    ):
                        if (folder / candidate).is_file():
                            icon_path = f"companies/{folder.name}/{candidate}"
                            break
                items.append(
                    {
                        "slug": brief.get("slug") or folder.name,
                        "company": brief.get("company") or folder.name,
                        "updated_at": brief.get("updated_at"),
                        "domain": brief.get("domain"),
                        "icon": icon_path,
                        "has_speech": (folder / "speech.txt").is_file(),
                        "path": f"companies/{folder.name}/brief.json",
                    }
                )
        return self._json(200, {"companies": items})

    def _serve_markdown(self, candidates: list[Path], missing_error: str) -> None:
        for path in candidates:
            if path.is_file():
                body = path.read_text(encoding="utf-8").encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/markdown; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        return self._json(404, {"error": missing_error})

    def _serve_candidate(self) -> None:
        skill = ROOT / ".cursor" / "skills" / "job-search"
        return self._serve_markdown(
            [skill / "candidate.md", skill / "candidate.example.md"],
            "candidate profile not found",
        )

    def _serve_resume(self) -> None:
        skill = ROOT / ".cursor" / "skills" / "job-generate-resume"
        return self._serve_markdown(
            [
                ROOT / "resume" / "resume.md",
                skill / "base-resume.md",
                skill / "base-resume.example.md",
            ],
            "base resume markdown not found",
        )

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/sources":
            return self._post_sources()
        if path == "/api/scout/targets":
            return self._post_scout_targets()
        if path == "/api/scout":
            return self._post_scout()
        if path == "/api/recruiters":
            return self._post_recruiters()
        if path != "/api/leads":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid json"})

        action = payload.get("action")
        lead_id = payload.get("id")
        if not action or not lead_id:
            return self._json(400, {"error": "action and id required"})

        folder = lead_dir(lead_id)
        if not folder.is_dir():
            return self._json(404, {"error": "lead not found"})

        index = read_index()

        try:
            if action == "set_status":
                status = payload.get("status")
                if status not in VALID_STATUSES:
                    return self._json(
                        400,
                        {
                            "error": (
                                "status must be active, in_progress, applied, "
                                "interview, or dead"
                            )
                        },
                    )
                meta = load_meta(lead_id)
                if "interviews" not in meta or not isinstance(
                    meta.get("interviews"), list
                ):
                    meta["interviews"] = []
                apply_status_side_effects(
                    meta,
                    status,
                    dead_reason=payload.get("dead_reason") if status == "dead" else None,
                )
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "set_interviews":
                try:
                    interviews = normalize_interviews(payload.get("interviews"))
                except ValueError as exc:
                    return self._json(400, {"error": str(exc)})
                meta = load_meta(lead_id)
                meta["interviews"] = interviews
                if "status" not in meta:
                    meta["status"] = "active"
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "mark_dead":
                meta = load_meta(lead_id)
                apply_status_side_effects(
                    meta, "dead", dead_reason=payload.get("dead_reason")
                )
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "revive":
                meta = load_meta(lead_id)
                apply_status_side_effects(meta, "active")
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "mark_applied":
                meta = load_meta(lead_id)
                apply_status_side_effects(
                    meta,
                    "applied",
                    applied_at=payload.get("applied_at"),
                )
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "unmark_applied":
                meta = load_meta(lead_id)
                apply_status_side_effects(meta, "active")
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "delete":
                meta = load_meta(lead_id)
                applied = bool(meta.get("applied")) or meta.get("status") == "applied"
                if applied:
                    return self._json(
                        409,
                        {
                            "error": (
                                "Cannot delete an applied lead — keep it for "
                                "application tracking (use mark_dead instead)"
                            ),
                            "applied": True,
                            "applied_at": meta.get("applied_at"),
                        },
                    )
                leads = index.setdefault("leads", [])
                index["leads"] = [e for e in leads if e.get("id") != lead_id]
                write_index(index)
                folder = lead_dir(lead_id)
                if folder.is_dir():
                    shutil.rmtree(folder)
                return self._json(
                    200,
                    {"ok": True, "deleted": lead_id},
                )

            return self._json(400, {"error": f"unknown action: {action}"})
        except Exception as exc:  # noqa: BLE001 — surface to client
            return self._json(500, {"error": str(exc)})

    def _read_json_body(self) -> dict | None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def _post_scout_targets(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return self._json(400, {"error": "invalid json"})
        action = payload.get("action") or "add"
        try:
            targets = read_scout_targets()
            companies = list(targets.get("companies") or [])
            if action == "add":
                name = str(payload.get("name") or "").strip()
                if not name:
                    return self._json(400, {"error": "name required"})
                slug = company_slug(payload.get("slug") or name)
                domain = str(payload.get("domain") or "").strip() or None
                notes = str(payload.get("notes") or "")
                existing = next((c for c in companies if c["slug"] == slug), None)
                if existing:
                    if domain:
                        existing["domain"] = domain
                    if notes:
                        existing["notes"] = notes
                    if name:
                        existing["name"] = name
                else:
                    companies.append(
                        {
                            "slug": slug,
                            "name": name,
                            "domain": domain,
                            "added_at": utc_now(),
                            "notes": notes,
                        }
                    )
                write_scout_targets({"companies": companies})
                folder = scout_dir(slug)
                if not (folder / "scout.json").is_file():
                    save_scout(slug, empty_scout(slug, name))
                return self._json(200, {"ok": True, **list_scout_payload()})
            if action == "remove":
                slug = company_slug(payload.get("slug") or payload.get("name") or "")
                if not slug:
                    return self._json(400, {"error": "slug required"})
                companies = [c for c in companies if c.get("slug") != slug]
                write_scout_targets({"companies": companies})
                return self._json(200, {"ok": True, **list_scout_payload()})
            return self._json(400, {"error": f"unknown action: {action}"})
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"error": str(exc)})

    def _post_scout(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return self._json(400, {"error": "invalid json"})
        action = payload.get("action")
        slug = company_slug(payload.get("slug") or "")
        finding_id = str(payload.get("finding_id") or "").strip()
        if not action:
            return self._json(400, {"error": "action required"})
        try:
            if action == "promote_finding":
                if not slug or not finding_id:
                    return self._json(400, {"error": "slug and finding_id required"})
                result = promote_finding(slug, finding_id)
                return self._json(200, {"ok": True, **result})
            if action == "demote_finding":
                if not slug or not finding_id:
                    return self._json(400, {"error": "slug and finding_id required"})
                result = demote_finding(slug, finding_id)
                return self._json(200, {"ok": True, **result})
            return self._json(400, {"error": f"unknown action: {action}"})
        except ValueError as exc:
            return self._json(400, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"error": str(exc)})

    def _post_recruiters(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return self._json(400, {"error": "invalid json"})
        action = payload.get("action")
        if not action:
            return self._json(400, {"error": "action required"})
        try:
            if action == "set_status":
                rid = str(payload.get("id") or "").strip()
                status = payload.get("status")
                if not rid:
                    return self._json(400, {"error": "id required"})
                if status not in RECRUITER_STATUSES:
                    return self._json(
                        400, {"error": "status must be found, contacted, or dead"}
                    )
                if not (recruiter_dir(rid) / "meta.json").is_file():
                    return self._json(404, {"error": "recruiter not found"})
                meta = load_recruiter_meta(rid)
                apply_recruiter_status(
                    meta,
                    status,
                    dead_reason=payload.get("dead_reason") if status == "dead" else None,
                )
                save_recruiter_meta(rid, meta)
                index = read_recruiters_index()
                sync_recruiter_manifest_entry(index, meta)
                write_recruiters_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            if action == "upsert":
                name = str(payload.get("name") or "").strip()
                if not name:
                    return self._json(400, {"error": "name required"})
                rid = str(payload.get("id") or "").strip()
                if not rid:
                    stamp = utc_now().replace("-", "").replace(":", "")[:13]
                    stamp = stamp.replace("T", "-")
                    firm = kebab_fragment(payload.get("firm") or "recruiter", 20)
                    rid = f"{stamp}-{kebab_fragment(name, 24)}-{firm}"
                base = rid
                n = 2
                while recruiter_dir(rid).exists() and not (
                    recruiter_dir(rid) / "meta.json"
                ).is_file():
                    rid = f"{base}-{n}"
                    n += 1
                existing = None
                if (recruiter_dir(rid) / "meta.json").is_file():
                    existing = load_recruiter_meta(rid)
                meta = existing or {
                    "id": rid,
                    "status": "found",
                    "dead_reason": None,
                    "found_at": utc_now(),
                    "contacted_at": None,
                    "sources": [],
                    "companies": [],
                    "notes": "",
                    "email": None,
                }
                meta["id"] = rid
                meta["name"] = name
                for key in ("firm", "linkedin_url", "email", "focus", "notes"):
                    if key in payload and payload[key] is not None:
                        meta[key] = payload[key]
                if isinstance(payload.get("companies"), list):
                    meta["companies"] = [
                        company_slug(c) for c in payload["companies"] if str(c).strip()
                    ]
                if isinstance(payload.get("sources"), list):
                    meta["sources"] = [str(s) for s in payload["sources"] if str(s).strip()]
                if payload.get("status") in RECRUITER_STATUSES and not existing:
                    meta["status"] = payload["status"]
                save_recruiter_meta(rid, meta)
                index = read_recruiters_index()
                sync_recruiter_manifest_entry(index, meta)
                write_recruiters_index(index)
                return self._json(200, {"ok": True, "meta": meta})

            return self._json(400, {"error": f"unknown action: {action}"})
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"error": str(exc)})

    def _post_sources(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid json"})

        action = payload.get("action") or "set_disabled"
        current = read_sources()
        disabled = set(current.get("disabled") or [])

        try:
            if action in {"set_disabled", "replace"}:
                incoming = payload.get("disabled")
                if not isinstance(incoming, list):
                    return self._json(400, {"error": "disabled must be a list"})
                disabled = {
                    str(item).strip().lower()
                    for item in incoming
                    if str(item).strip()
                }
            elif action == "set":
                source_id = str(payload.get("id") or "").strip().lower()
                if not source_id:
                    return self._json(400, {"error": "id required"})
                enabled = payload.get("enabled")
                if enabled is None:
                    return self._json(400, {"error": "enabled required"})
                if enabled:
                    disabled.discard(source_id)
                else:
                    disabled.add(source_id)
            elif action == "enable_all":
                disabled = set()
            elif action == "disable_all":
                disabled = set(SOURCE_IDS)
            else:
                return self._json(400, {"error": f"unknown action: {action}"})

            write_sources({"disabled": sorted(disabled)})
            return self._json(200, {"ok": True, **sources_payload()})
        except Exception as exc:  # noqa: BLE001
            return self._json(500, {"error": str(exc)})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {fmt % args}")


def main() -> None:
    LEADS.mkdir(parents=True, exist_ok=True)
    SCOUT.mkdir(parents=True, exist_ok=True)
    RECRUITERS.mkdir(parents=True, exist_ok=True)
    ensure_sources_file()
    ensure_scout_targets_file()
    ensure_recruiters_index()
    if not INDEX.exists():
        example = LEADS / "index.example.json"
        if example.exists():
            INDEX.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
        else:
            write_index({"updated_at": None, "leads": []})

    class ReusableThreadingHTTPServer(ThreadingHTTPServer):
        allow_reuse_address = True

    server = ReusableThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Job leads board → http://{HOST}:{PORT}")
    print(
        "API: GET /api/health · GET /api/candidate · GET /api/resume · "
        "GET /api/companies · GET|POST /api/sources · POST /api/leads · "
        "GET|POST /api/scout · GET|POST /api/scout/targets · "
        "GET|POST /api/recruiters"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
