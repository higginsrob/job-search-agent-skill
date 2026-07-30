#!/usr/bin/env python3
"""Run the leads board with auto-restart when watched files change.

Usage (from repo root):
  python3 scripts/dev_server.py
  # or: make dev
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "scripts" / "serve_leads.py"
POLL_SECONDS = 0.5
CRASH_BACKOFF_SECONDS = 2.0

WATCH_PATHS = [
    SERVER,
    ROOT / "scripts" / "dev_server.py",
    ROOT / "index.html",
    ROOT / "assets",
]


def watched_mtimes() -> dict[Path, float]:
    mtimes: dict[Path, float] = {}
    for path in WATCH_PATHS:
        if path.is_file():
            mtimes[path] = path.stat().st_mtime
        elif path.is_dir():
            for child in path.rglob("*"):
                if child.is_file():
                    mtimes[child] = child.stat().st_mtime
    return mtimes


def start_server() -> subprocess.Popen:
    print(f"[dev] starting {SERVER.relative_to(ROOT)} …", flush=True)
    return subprocess.Popen(
        [sys.executable, str(SERVER)],
        cwd=ROOT,
        start_new_session=True,
    )


def stop_server(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()


def main() -> None:
    proc = start_server()
    last = watched_mtimes()
    try:
        while True:
            time.sleep(POLL_SECONDS)
            if proc.poll() is not None:
                code = proc.returncode
                print(
                    f"[dev] server exited ({code}); retrying in {CRASH_BACKOFF_SECONDS:.0f}s …",
                    flush=True,
                )
                time.sleep(CRASH_BACKOFF_SECONDS)
                proc = start_server()
                last = watched_mtimes()
                continue
            current = watched_mtimes()
            if current != last:
                changed = sorted(
                    p.relative_to(ROOT).as_posix()
                    for p in set(current) | set(last)
                    if current.get(p) != last.get(p)
                )
                print(f"[dev] reload ({', '.join(changed)})", flush=True)
                stop_server(proc)
                proc = start_server()
                last = watched_mtimes()
    except KeyboardInterrupt:
        print("\n[dev] stopped.", flush=True)
    finally:
        stop_server(proc)


if __name__ == "__main__":
    main()
