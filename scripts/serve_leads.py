#!/usr/bin/env python3
"""Serve the job leads board with set-status / applied / mark-dead API.

Lead folders are never deleted: action "delete" aliases to mark_dead.

Usage (from repo root):
  make server
  # or: python3 scripts/serve_leads.py
  # → http://127.0.0.1:8765
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
LEADS = ROOT / "leads"
COMPANIES = ROOT / "companies"
INDEX = LEADS / "index.json"
SOURCES_FILE = LEADS / "sources.json"
SOURCES_EXAMPLE = LEADS / "sources.example.json"
HOST = "127.0.0.1"
PORT = 8765
VALID_STATUSES = frozenset(
    {"active", "in_progress", "applied", "interview", "dead"}
)

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
]
SOURCE_IDS = frozenset(item["id"] for item in SOURCE_CATALOG)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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
    """Keep applied flags in sync with the Applied swim lane."""
    meta["status"] = status
    if status == "applied":
        meta["applied"] = True
        meta["applied_at"] = applied_at or meta.get("applied_at") or utc_now()
        meta["dead_reason"] = None
    elif status == "interview":
        # Keep applied history; clear dead only
        meta["dead_reason"] = None
    elif status == "dead":
        meta["applied"] = False
        meta["applied_at"] = None
        meta["dead_reason"] = dead_reason
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
                # Never remove lead folders — map delete → mark dead.
                meta = load_meta(lead_id)
                reason = payload.get("dead_reason") or "Marked dead via UI (folders are never deleted)"
                apply_status_side_effects(meta, "dead", dead_reason=reason)
                save_meta(lead_id, meta)
                sync_manifest_entry(index, meta)
                write_index(index)
                return self._json(
                    200,
                    {
                        "ok": True,
                        "meta": meta,
                        "marked_dead": lead_id,
                        "note": "delete aliases to mark_dead; lead folder retained",
                    },
                )

            return self._json(400, {"error": f"unknown action: {action}"})
        except Exception as exc:  # noqa: BLE001 — surface to client
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
    ensure_sources_file()
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
        "GET /api/companies · GET|POST /api/sources · POST /api/leads"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
