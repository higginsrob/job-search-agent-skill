#!/usr/bin/env python3
"""Render a resume HTML file to PDF via Chrome headless.

Usage:
  python3 render_resume_pdf.py <input.html> <output.pdf>
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

CHROME_CANDIDATES = [
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
    shutil.which("google-chrome"),
    shutil.which("chromium"),
    shutil.which("chromium-browser"),
]


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if not c:
            continue
        p = Path(c)
        if p.exists():
            return str(p)
    raise SystemExit(
        "Chrome/Chromium not found. Install Google Chrome or pass a browser on PATH."
    )


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        raise SystemExit(2)

    html = Path(sys.argv[1]).resolve()
    pdf = Path(sys.argv[2]).resolve()
    if not html.is_file():
        raise SystemExit(f"HTML not found: {html}")

    pdf.parent.mkdir(parents=True, exist_ok=True)
    chrome = find_chrome()
    uri = html.as_uri()

    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf}",
        uri,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not pdf.is_file():
        err = (proc.stderr or proc.stdout or "").strip()
        raise SystemExit(f"PDF render failed (exit {proc.returncode}): {err}")
    print(f"Wrote {pdf}")


if __name__ == "__main__":
    main()
