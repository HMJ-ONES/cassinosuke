#!/usr/bin/env python3
"""Decode the base64 cover art in images/ back to .webp files.

Why this exists: the GitHub push route used for this repo only carries
UTF-8 text, so binary images are stored as base64 text files
(images/<name>.webp.b64). Cloudflare Pages runs this as its build
command (`python3 decode_images.py`) so the deployed site serves real
.webp files at images/<name>.webp, exactly as index.html references.

Run locally any time after editing an image:
    python3 decode_images.py
To re-encode an image after replacing a .webp:
    base64 -w0 images/<name>.webp > images/<name>.webp.b64
"""
import base64
from pathlib import Path

HERE = Path(__file__).resolve().parent

for b64_path in sorted((HERE / "images").glob("*.webp.b64")):
    out_path = b64_path.with_suffix("")  # strips .b64 -> <name>.webp
    data = base64.b64decode(b64_path.read_text().strip())
    out_path.write_bytes(data)
    print(f"decoded {b64_path.name} -> {out_path.name} ({len(data)} bytes)")
