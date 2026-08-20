#!/usr/bin/env node
/**
 * Brand audit — fails when any new frontend file hardcodes the capital
 * brand string "Addrika" outside the single source of truth
 * (`frontend-next/lib/brand.config.js`).
 *
 * Why case-sensitive?
 * -------------------
 * The rebrand story only cares about *user-facing copy*, which is always
 * capitalized. Lower-case `addrika` shows up in URL slugs, localStorage
 * keys, asset filenames and CSS classes — those stay stable across
 * rebrand for SEO / backwards-compatibility and are safe to keep.
 *
 * Usage
 * -----
 *   node scripts/brand-audit.js          # exits 1 on any violation
 *   yarn --cwd frontend-next brand-audit # same, via the npm script
 *
 * Whitelist
 * ---------
 * • `frontend-next/lib/brand.config.js`  — the single source of truth.
 * • Any occurrence inside a `//` line-comment or `/* … *\/` block-comment
 *   (comments never render).
 * • Component / function identifiers that mirror an SEO route slug we
 *   want to keep for backlinks (`WhyChooseAddrika…`, `AddrikaLogo…`).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'frontend-next');
const SCAN_DIRS = ['app', 'components', 'context', 'lib'];
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const NEEDLE = 'Addrika'; // case-sensitive on purpose (see file header)

/** Files that are allowed to reference the brand string literally. */
const FILE_WHITELIST = new Set([
  path.join(ROOT, 'lib', 'brand.config.js'),
]);

/** Identifier prefixes tied to SEO route slugs — safe as identifiers. */
const IDENTIFIER_WHITELIST = [
  /\bWhyChooseAddrika[A-Za-z0-9_]*/g,
];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Strip `//` line comments and `/* … *\/` block comments while
 * PRESERVING newline offsets so violation line numbers stay accurate. */
function stripComments(src) {
  // Block comments — replace with spaces but keep every '\n' inside intact.
  let cleaned = src.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );
  // Line comments — keep the trailing \n so line numbers still line up.
  cleaned = cleaned.replace(/(^|[^:])\/\/[^\n]*/g, (match, prefix) => prefix + ' '.repeat(match.length - prefix.length));
  // Identifier whitelist — blank out matches so they don't trip the scan
  for (const re of IDENTIFIER_WHITELIST) {
    cleaned = cleaned.replace(re, (m) => ' '.repeat(m.length));
  }
  return cleaned;
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const cleaned = stripComments(src);
  const rawLines = src.split(/\r?\n/);
  const cleanedLines = cleaned.split(/\r?\n/);
  const hits = [];
  cleanedLines.forEach((cLine, idx) => {
    if (cLine.includes(NEEDLE)) {
      hits.push({
        line: idx + 1,
        snippet: rawLines[idx].trim(),
        kind: 'hardcoded-brand',
      });
    }
    // Also catch the common typo of writing `${BRAND.name}` inside a
    // single- or double-quoted string, where the template literal never
    // interpolates and the raw `${BRAND.name}` renders to the user.
    // Rule A: same-line — matches quoted-string or single-line JSX.
    const badTemplateA =
      /(['"])[^'"`\n]*\$\{BRAND\.name\}[^'"`\n]*\1/.test(cLine) ||
      />[^<`{]*\$\{BRAND\.name\}[^<`}]*</.test(cLine);
    // Rule B: multi-line JSX text — any line that contains `${BRAND.name}`
    // AND no backtick anywhere on the line is unambiguously broken JSX:
    // template literals require backticks, so a backtick-less `$…` is
    // JSX text where React interpolates `{BRAND.name}` but keeps the
    // stray `$` as literal (renders as `$Addrika`). Cheap heuristic,
    // structurally impossible to hit legitimate template literals.
    const badTemplateB = /\$\{BRAND\.name\}/.test(cLine) && !cLine.includes('`');
    if (badTemplateA || badTemplateB) {
      hits.push({
        line: idx + 1,
        snippet: rawLines[idx].trim(),
        kind: 'literal-template',
      });
    }
  });
  return hits;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d), []))
    .filter((f) => !FILE_WHITELIST.has(f));

  const violations = [];
  for (const f of files) {
    const hits = scanFile(f);
    for (const h of hits) violations.push({ file: f, ...h });
  }

  if (violations.length === 0) {
    console.log(`\u2713 brand-audit: 0 hardcoded "${NEEDLE}" references found across ${files.length} scanned files.`);
    process.exit(0);
  }

  console.error(`\u2717 brand-audit: found ${violations.length} issue(s):\n`);
  for (const v of violations) {
    const rel = path.relative(path.dirname(ROOT), v.file);
    const tag = v.kind === 'literal-template' ? '[literal-\${BRAND.name}]' : '[hardcoded-Addrika]';
    console.error(`  ${rel}:${v.line}  ${tag}  ${v.snippet}`);
  }
  console.error(
    `\nFix (hardcoded-Addrika): import BRAND from '@/lib/brand.config' and use \`${'${BRAND.name}'}\` inside a template literal.` +
    `\nFix (literal-\${BRAND.name}): the string uses single/double quotes but writes \${BRAND.name} — switch to backticks OR to JSX \`{BRAND.name}\`.`,
  );
  process.exit(1);
}

main();
