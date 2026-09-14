#!/usr/bin/env node
/**
 * Portability linter.
 *
 * The primary requirement for this project is that `site/` works when opened
 * directly from a filesystem, with no web server. See docs/BUILD-SPEC.md section 0.
 *
 * A local dev server hides violations of that requirement, because it resolves
 * root-absolute paths and directory indexes that `file://` cannot. This script
 * scans the built output for constructs that work on localhost and fail offline.
 *
 * Run after `npm run build`. Exits non-zero on any error.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const SITE = "site";

/** Each rule: a regex, a severity, and an explanation the reader can act on. */
const RULES = [
  {
    id: "absolute-href",
    re: /(?:href|src)\s*=\s*"\/(?!\/)/g,
    level: "error",
    msg: 'Root-absolute path. Under file:// this resolves to the filesystem root.',
    fix: "Use the `rel` filter: href=\"{{ '/path/to/page.html' | rel }}\""
  },
  {
    id: "directory-link",
    re: /href\s*=\s*"(?:\.{1,2}\/)*[^"#?]*\/"/g,
    level: "error",
    msg: "Directory link with no filename. file:// does not resolve index.html.",
    fix: 'Link to the file explicitly: href="../lux/index.html"'
  },
  {
    id: "fetch",
    re: /\bfetch\s*\(|XMLHttpRequest/g,
    level: "error",
    msg: "Network request. Blocked under file:// because the origin is null.",
    fix: "Read window.COUNTY_AI_DATA, loaded via a classic <script src>."
  },
  {
    id: "es-module",
    re: /type\s*=\s*"module"/g,
    level: "error",
    msg: "ES module script. Blocked under file:// by the same CORS rules.",
    fix: "Use a classic <script> with no type attribute."
  },
  {
    id: "external-url",
    re: /(?:href|src)\s*=\s*"https?:\/\//g,
    level: "warn",
    msg: "External URL. Will fail when the folder is opened offline.",
    fix: "Vendor the resource, or confirm it is a human-facing reference link."
  },
  {
    id: "external-svg-use",
    re: /<use[^>]+(?:xlink:)?href\s*=\s*"[^"#][^"]*#/g,
    level: "error",
    msg: "External SVG sprite reference. Blocked under file://.",
    fix: "Inline the SVG markup directly in the template."
  }
];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(html|js|css)$/.test(entry)) out.push(full);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

if (!existsSync(SITE)) {
  console.error(`No ${SITE}/ directory. Run \`npm run build\` first.`);
  process.exit(1);
}

const files = walk(SITE);
let errors = 0;
let warnings = 0;
const seen = new Map();

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      const key = rule.id;
      if (!seen.has(key)) seen.set(key, { rule, hits: [] });
      seen.get(key).hits.push(`${relative(".", file)}:${lineOf(text, m.index)}`);
      if (rule.level === "error") errors++;
      else warnings++;
    }
  }
}

if (seen.size === 0) {
  console.log(`Portability check passed. ${files.length} files scanned, no issues.`);
  process.exit(0);
}

for (const { rule, hits } of seen.values()) {
  const label = rule.level === "error" ? "ERROR" : "warn ";
  console.log(`\n${label}  [${rule.id}]  ${hits.length} occurrence(s)`);
  console.log(`       ${rule.msg}`);
  console.log(`       Fix: ${rule.fix}`);
  for (const hit of hits.slice(0, 8)) console.log(`         ${hit}`);
  if (hits.length > 8) console.log(`         ... and ${hits.length - 8} more`);
}

console.log(
  `\n${files.length} files scanned. ${errors} error(s), ${warnings} warning(s).`
);
if (errors > 0) {
  console.log("\nThe built site will not work offline until the errors are fixed.");
  process.exit(1);
}
process.exit(0);
