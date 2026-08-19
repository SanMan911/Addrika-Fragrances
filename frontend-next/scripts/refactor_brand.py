#!/usr/bin/env python3
"""
Bulk-refactor script: replace every hardcoded "Addrika" reference in
Next.js source files with `${BRAND.name}` (template literal) or
`{BRAND.name}` (JSX child), and inject the import.

Value stays "Addrika" — this is a wiring refactor so a future
`BRAND.name = 'X'` flip propagates everywhere.

Run once from /app/frontend-next.  Idempotent: files already migrated
(with the BRAND import) are skipped.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

IGNORE_FILES = {
    "lib/brand.config.js",                         # source of truth
    "components/RetailerPartnershipModal.js",      # WhatsApp deep-link — reviewed separately
}

BRAND_IMPORT_JS = "const { BRAND } = require('__PATH__');"
BRAND_IMPORT_ESM = "import BRAND from '__PATH__';"


def rel_import_path(file_path: Path) -> str:
    """`../../lib/brand.config` from any file, calculated from ROOT."""
    rel = os.path.relpath(ROOT / "lib" / "brand.config", file_path.parent)
    if not rel.startswith("."):
        rel = "./" + rel
    return rel.replace(os.sep, "/")


def uses_esm(source: str) -> bool:
    return bool(re.search(r"^\s*import\s+", source, re.MULTILINE))


def find_import_insertion(source: str) -> int:
    """Return the index at which to insert a new import."""
    lines = source.splitlines(keepends=True)
    idx = 0
    # Skip 'use client' / 'use server' directives
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith(("'use client'", '"use client"', "'use server'", '"use server"')):
            idx = i + 1
            continue
        if stripped.startswith(("import ", "const ", "require(")):
            # Push past contiguous import block
            j = i
            while j < len(lines) and lines[j].strip().startswith(("import ", "const ", "require(", "//", "/*", "*", "*/")):
                j += 1
            return sum(len(l) for l in lines[:j])
        if stripped and not stripped.startswith(("//", "/*", "*")):
            break
    return sum(len(l) for l in lines[:idx])


def ensure_brand_import(source: str, file_path: Path) -> tuple[str, bool]:
    if "BRAND" in source and re.search(r"\bBRAND\b\s*[\.\[]", source):
        # Already references BRAND but might already import it — check
        if re.search(r"(import\s+.*BRAND.*from|require\([^)]*brand\.config)", source):
            return source, False
    imp_path = rel_import_path(file_path)
    line = (BRAND_IMPORT_ESM if uses_esm(source) else BRAND_IMPORT_JS).replace("__PATH__", imp_path) + "\n"
    insert_at = find_import_insertion(source)
    return source[:insert_at] + line + source[insert_at:], True


def convert_addrika_strings(source: str) -> tuple[str, int]:
    """Replace hardcoded "Addrika" occurrences with BRAND.name references.

    Handled patterns:
      1. JSX text  >Addrika<           →  >{BRAND.name}<
      2. JSX text  >Addrika Foo<       →  >{`${BRAND.name} Foo`}<
      3. Single-quoted 'Addrika'       →  BRAND.name
      4. 'Addrika Foo'                 →  `${BRAND.name} Foo`
      5. Double-quoted "Addrika"       →  BRAND.name  (attr value → {BRAND.name})
      6. "Addrika Foo"                 →  `${BRAND.name} Foo`
      7. Template literal `... Addrika ...` → `... ${BRAND.name} ...`
      8. JSX attr  attr="Addrika ..."  →  attr={`${BRAND.name} ...`}
    """
    original = source
    count = 0

    # --- 8. JSX attribute value containing "Addrika": key="...Addrika..." ---
    def _attr(m: re.Match) -> str:
        key, val = m.group(1), m.group(2)
        new_val = val.replace("Addrika", "${BRAND.name}")
        # If unchanged (no "Addrika" — shouldn't happen due to filter), skip
        return f'{key}={{`{new_val}`}}'
    source, n = re.subn(
        r'(\b[a-zA-Z_][a-zA-Z0-9_-]*)="([^"\n]*Addrika[^"\n]*)"',
        _attr, source,
    )
    count += n

    # --- 1 & 2. JSX text: >Foo Addrika Bar< (not inside tags) ---
    def _jsx_text(m: re.Match) -> str:
        left, middle, right = m.group(1), m.group(2), m.group(3)
        # `middle` contains Addrika; wrap in {`...`}
        expr = middle.replace("Addrika", "${BRAND.name}")
        return f">{left}{{`{expr}`}}{right}<"
    # Match: >...Addrika...<  where content is plain text (no {} braces)
    source, n = re.subn(
        r">([^<{}\n]*)(\bAddrika\b[^<{}\n]*)([^<{}\n]*)<",
        lambda m: (
            ">" +
            (
                "{`" + (m.group(1) + m.group(2) + m.group(3)).replace("Addrika", "${BRAND.name}") + "`}"
                if (m.group(1) + m.group(2) + m.group(3)).strip() and "Addrika" in (m.group(1) + m.group(2) + m.group(3))
                else m.group(1) + m.group(2) + m.group(3)
            )
            + "<"
        ),
        source,
    )
    count += n

    # --- 7. Template literals with `...Addrika...` ---
    def _tpl(m: re.Match) -> str:
        content = m.group(1)
        return "`" + content.replace("Addrika", "${BRAND.name}") + "`"
    source, n = re.subn(r"`([^`]*\bAddrika\b[^`]*)`", _tpl, source)
    count += n

    # --- 3-6. Regular string literals (single or double quoted) ---
    def _str(m: re.Match) -> str:
        quote = m.group(1)
        content = m.group(2)
        if content == "Addrika":
            return "BRAND.name"
        # Contains other text — convert to template literal
        return "`" + content.replace("Addrika", "${BRAND.name}") + "`"
    source, n = re.subn(
        r"""(['"])((?:(?!\1)[^\\\n]|\\.)*\bAddrika\b(?:(?!\1)[^\\\n]|\\.)*)\1""",
        _str, source,
    )
    count += n

    if source == original:
        return source, 0
    return source, count


def main() -> int:
    total_files = 0
    total_replacements = 0
    skipped = []
    changed = []

    for js_file in sorted(ROOT.rglob("*.js")):
        rel = js_file.relative_to(ROOT).as_posix()
        if rel.startswith(("node_modules/", ".next/", "public/", "styles/")):
            continue
        if rel in IGNORE_FILES:
            skipped.append(rel + " (ignored)")
            continue
        try:
            text = js_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if "Addrika" not in text:
            continue

        new_text, n_repl = convert_addrika_strings(text)
        if n_repl == 0:
            skipped.append(rel + " (no safe pattern matched)")
            continue

        new_text, added_import = ensure_brand_import(new_text, js_file)

        js_file.write_text(new_text, encoding="utf-8")
        changed.append(f"{rel}  (+{n_repl} refs{', +import' if added_import else ''})")
        total_files += 1
        total_replacements += n_repl

    print(f"\n✅ Rewrote {total_files} files with {total_replacements} references replaced.\n")
    for c in changed:
        print("  · " + c)
    if skipped:
        print("\n⚠️  Skipped:")
        for s in skipped:
            print("  · " + s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
