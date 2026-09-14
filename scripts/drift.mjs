#!/usr/bin/env node
/**
 * Report how far the lexia tree has moved from the frozen v5 workshop document.
 *
 * src/sources/workshop-1-policy-texts-v5.md is what the June 10 workshop actually
 * produced. Once the lexias became the source of truth, that file stopped being an input
 * and became the historical record. This script is what makes the record useful: it
 * answers "is this still the room's language, or has it been edited, and where?"
 *
 * That question has a real audience. A facilitator standing in front of stakeholders with
 * material attributed to a workshop those stakeholders attended needs to know whether the
 * text on the page is the text they wrote.
 *
 * Complements `npm run lint:lexias`, which compares lexias against each other. This one
 * compares them against history.
 *
 * Always exits 0 by default: drift is expected once review begins, and is a finding
 * rather than a fault. Use --fail-on-drift in a context that requires the tree to still
 * match the workshop exactly.
 *
 * Usage:
 *   npm run drift
 *   npm run drift -- --full            print the full word-level diff, not a summary
 *   npm run drift -- --fail-on-drift   exit 1 if anything has changed
 *   npm run drift -- --json            machine-readable output
 */
import { readFileSync, existsSync } from "node:fs";
import { splitFrontmatter } from "./lib/frontmatter.mjs";
import { parseViolationArc, parseEmployees } from "./lib/parse-v5.mjs";
import { readLexias, lexiaId } from "./lib/lexias.mjs";
import { wordDiff, formatDelta } from "./lib/word-diff.mjs";

const FROZEN_V5 = "src/sources/workshop-1-policy-texts-v5.md";

const args = process.argv.slice(2);
const full = args.includes("--full");
const failOnDrift = args.includes("--fail-on-drift");
const asJson = args.includes("--json");

if (!existsSync(FROZEN_V5)) {
  console.error(`Missing ${FROZEN_V5}; cannot measure drift without the provenance record.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build the original 64 cells from the frozen document.
// ---------------------------------------------------------------------------

const { frontmatter, body } = splitFrontmatter(readFileSync(FROZEN_V5, "utf8"));
const original = new Map();
for (const e of parseEmployees(body, parseViolationArc(frontmatter))) {
  for (const [flavorId, policy] of Object.entries(e.policies)) {
    for (const p of policy.paragraphs) {
      original.set(lexiaId(e.id, flavorId, p.dimension), p.text);
    }
  }
}

const current = readLexias();

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

const identical = [];
const changed = [];
const added = [];
const removed = [];

for (const [id, text] of original) {
  const lexia = current.get(id);
  if (!lexia) {
    removed.push(id);
    continue;
  }
  if (lexia.text === text) identical.push(id);
  else changed.push({ id, from: text, to: lexia.text, delta: formatDelta(text, lexia.text) });
}
for (const id of current.keys()) {
  if (!original.has(id)) added.push(id);
}

identical.sort();
changed.sort((a, b) => a.id.localeCompare(b.id));

if (asJson) {
  console.log(
    JSON.stringify(
      {
        source: FROZEN_V5,
        identical: identical.length,
        changed: changed.map((c) => ({ id: c.id, delta: c.delta })),
        added,
        removed
      },
      null,
      2
    )
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`${current.size} lexias vs ${FROZEN_V5}`);
console.log(`  ${identical.length} identical`);
console.log(`  ${changed.length} changed`);
if (added.length) console.log(`  ${added.length} added (not in the workshop document)`);
if (removed.length) console.log(`  ${removed.length} missing (in the workshop document, not in the tree)`);
console.log("");

for (const id of removed) console.log(`  missing  ${id}`);
for (const id of added) console.log(`  added    ${id}`);
if (removed.length || added.length) console.log("");

for (const c of changed) {
  console.log(`  ${c.id}   ${c.delta}`);
  const runs = wordDiff(c.from, c.to);
  if (full) {
    for (const run of runs) {
      if (run.op === "same") continue;
      const marker = run.op === "del" ? "-" : "+";
      console.log(`      ${marker} ${run.text.trim().replace(/\s+/g, " ")}`);
    }
  } else {
    for (const run of runs.filter((r) => r.op !== "same").slice(0, 6)) {
      const marker = run.op === "del" ? "-" : "+";
      const text = run.text.trim().replace(/\s+/g, " ");
      console.log(`      ${marker} ${text.length > 64 ? text.slice(0, 63) + "…" : text}`);
    }
  }
  console.log("");
}

if (!changed.length && !added.length && !removed.length) {
  console.log("  The tree still matches the workshop document exactly.\n");
}

if (failOnDrift && (changed.length || added.length || removed.length)) process.exit(1);
