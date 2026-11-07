#!/usr/bin/env python3
"""
Build the Chrome Web Store upload zip.

    python3 build-chrome.py

Output:
    dist/chrome/                    unpacked, identical to what gets zipped
    dist/4xs-toolbox-<version>.zip  the file to upload

The file list is DERIVED, never hand-maintained: start from manifest.json
(background, content scripts, popup, options, icons, web-accessible
resources), then follow <script src> and <link href> out of every HTML page
reached, transitively. That way adding a data file to a page or to the
manifest is enough - this script does not also have to be edited, and it
cannot silently ship an extension that is missing a file it references.

Anything not reachable that way is left out on purpose: the repo's docs/,
promo/, test/, _archive/, .git, the build scripts themselves, loose PDFs and
price-list spreadsheets, and prices.csv (nothing has referenced it since the
catalogue moved into catalog-data.js).

The dashboard rejects a manifest "description" longer than 132 characters, so
that is checked here rather than discovered on upload.
"""

import json
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "dist", "chrome")
DESCRIPTION_LIMIT = 132


def manifest_seeds(m):
    seeds = set()
    sw = m.get("background", {}).get("service_worker")
    if sw:
        seeds.add(sw)
    for entry in m.get("content_scripts", []):
        seeds.update(entry.get("js", []))
        seeds.update(entry.get("css", []))
    for war in m.get("web_accessible_resources", []):
        seeds.update(war.get("resources", []))
    seeds.update(m.get("icons", {}).values())
    seeds.update(m.get("action", {}).get("default_icon", {}).values())
    popup = m.get("action", {}).get("default_popup")
    if popup:
        seeds.add(popup)
    page = m.get("options_ui", {}).get("page")
    if page:
        seeds.add(page)
    return seeds


HTML_REF = re.compile(r"""(?:src|href)\s*=\s*["']([^"':#?]+)["']""", re.I)
# Pages the popup opens in a tab: chrome.tabs.create / runtime.getURL("x.html")
RUNTIME_PAGE = re.compile(r"""getURL\(\s*["']([^"']+\.html)["']""")


def collect():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as fh:
        m = json.load(fh)

    desc = m.get("description", "")
    if len(desc) > DESCRIPTION_LIMIT:
        raise SystemExit(
            "build-chrome: manifest description is %d chars, the dashboard "
            "rejects anything over %d" % (len(desc), DESCRIPTION_LIMIT))

    wanted, queue = set(), list(manifest_seeds(m))
    while queue:
        rel = queue.pop().lstrip("./")
        if rel in wanted:
            continue
        full = os.path.join(ROOT, rel)
        if not os.path.exists(full):
            raise SystemExit("build-chrome: referenced file is missing: %s" % rel)
        wanted.add(rel)

        if rel.lower().endswith(".html"):
            base = os.path.dirname(rel)
            with open(full, encoding="utf-8") as fh:
                page = fh.read()
            for ref in HTML_REF.findall(page):
                if ref.startswith(("http://", "https://", "data:", "//")):
                    continue
                queue.append(os.path.normpath(os.path.join(base, ref)))
        elif rel.lower().endswith(".js"):
            with open(full, encoding="utf-8") as fh:
                for ref in RUNTIME_PAGE.findall(fh.read()):
                    queue.append(ref)

    wanted.add("manifest.json")
    return m, sorted(wanted)


def main():
    manifest, files = collect()

    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    for rel in files:
        dest = os.path.join(OUT_DIR, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, rel), dest)

    version = manifest["version"]
    zip_path = os.path.join(ROOT, "dist", "4xs-toolbox-%s.zip" % version)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in files:
            zf.write(os.path.join(ROOT, rel), rel)

    print("Chrome build v%s" % version)
    print("  unpacked    : %s" % os.path.relpath(OUT_DIR, ROOT))
    print("  zip         : %s (%d KB)" % (os.path.relpath(zip_path, ROOT),
                                          os.path.getsize(zip_path) // 1024))
    print("  files       : %d" % len(files))
    print("  description : %d / %d chars" % (len(manifest["description"]), DESCRIPTION_LIMIT))
    for rel in files:
        print("    %s" % rel)


if __name__ == "__main__":
    main()
