#!/usr/bin/env node
/**
 * Report which lexias say the same thing as each other, and which do not.
 *
 * The 64 cells are sorted into 32 groups of (employee x dimension x setting). Within a
 * group every cell is the same employee, the same dimension, at the same Hi/Lo setting --
 * so you would expect the same sentence. For 19 groups it is. For 13 it is not.
 *
 * A divergence is not automatically wrong. Lux under Enable, Light-touch and Exposed all
 * set Efficiency Hi and carry three different sentences; that may be deliberate emphasis
 * or it may be three people drafting the same clause without comparing notes. Deciding
 * which is a human judgement, which is exactly why this reports rather than validates.
 * It is also a real failure mode: the upstream validation of these same texts flagged all
 * four Exposed/Innovation paragraphs as having drifted beyond what Innovation Hi licenses.
 *
 * The lockfile turns the report into a guard. content/variant-groups.lock.json records
 * the current shape; --fail-on-change fails when that shape moves, so an edit that
 * accidentally splits a matched group, or accidentally collapses a deliberate difference,
 * is caught rather than merged. Intended changes are recorded with --write-lock.
 *
 * Usage:
 *   npm run lint:lexias
 *   npm run lint:lexias -- --fail-on-change     compare against the lockfile, exit 1 on drift
 *   npm run lint:lexias -- --write-lock         record the current shape as intended
 *   npm run lint:lexias -- --json               machine-readable output
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readFlavors, readLexias } from "./lib/lexias.mjs";
import { groupLexias, lockShape } from "./lib/groups.mjs";

const LOCK_FILE = "content/variant-groups.lock.json";

const args = process.argv.slice(2);
const failOnChange = args.includes("--fail-on-change");
const writeLock = args.includes("--write-lock");
const asJson = args.includes("--json");

const flavors = readFlavors();
const lexias = readLexias();
const { groups, identicalCount, divergentCount } = groupLexias(flavors, lexias);

if (asJson) {
  console.log(JSON.stringify({ identicalCount, divergentCount, groups: lockShape(groups) }, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(
  `${lexias.size} lexias in ${groups.length} groups by (employee, dimension, setting)\n` +
  `  ${identicalCount} identical across the flavors that share the setting\n` +
  `  ${divergentCount} divergent\n`
);

// Under --fail-on-change the caller wants a pass/fail and the delta, not the full
// inventory. Printing 60 lines of unchanged groups into CI output buries the one line
// that matters.
const verbose = !failOnChange && !writeLock;

const divergent = groups.filter((g) => !g.identical);
if (verbose && divergent.length) {
  console.log("Divergent groups -- same dimension setting, different words:\n");
  for (const g of divergent) {
    const label = `${g.employee} / ${g.dimension} ${g.setting}`;
    console.log(`  ${label.padEnd(34)} ${g.variantCount} variants`);
    for (const [i, v] of g.variants.entries()) {
      const flavorList = v.flavors.join(", ");
      const delta = i === 0 ? "baseline" : v.deltaVsFirst;
      console.log(`      ${String(i + 1).padStart(2)}. ${flavorList.padEnd(18)} ${delta}`);
      if (i > 0) console.log(`          ${summarize(v.diffVsFirst)}`);
    }
    console.log("");
  }
}

const identical = groups.filter((g) => g.identical);
if (verbose && identical.length) {
  console.log("Identical groups:\n");
  for (const g of identical) {
    const label = `${g.employee} / ${g.dimension} ${g.setting}`;
    console.log(`  ${label.padEnd(34)} ${g.variants[0].flavors.join(", ")}`);
  }
  console.log("");
}

/** One line naming what was added and removed, elided in the middle if long. */
function summarize(runs) {
  const parts = [];
  for (const run of runs) {
    if (run.op === "same") continue;
    const text = run.text.trim().replace(/\s+/g, " ");
    if (!text) continue;
    parts.push(`${run.op === "del" ? "-" : "+"} ${clip(text)}`);
  }
  return parts.length ? parts.slice(0, 4).join("   ") : "(whitespace only)";
}

function clip(s, n = 46) {
  return s.length <= n ? `"${s}"` : `"${s.slice(0, n - 1)}…"`;
}

// ---------------------------------------------------------------------------
// Lockfile
// ---------------------------------------------------------------------------

const shape = lockShape(groups);

if (writeLock) {
  writeFileSync(
    LOCK_FILE,
    JSON.stringify(
      {
        note:
          "Which lexias are byte-identical within each (employee, dimension, setting) " +
          "group. `npm run lint:lexias -- --fail-on-change` fails when this shape moves. " +
          "Regenerate deliberately with `npm run lint:lexias -- --write-lock`.",
        groups: shape
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Wrote ${LOCK_FILE} (${identicalCount} identical, ${divergentCount} divergent).`);
  process.exit(0);
}

if (!failOnChange) process.exit(0);

if (!existsSync(LOCK_FILE)) {
  console.error(`No ${LOCK_FILE}. Create one with \`npm run lint:lexias -- --write-lock\`.`);
  process.exit(1);
}

const locked = JSON.parse(readFileSync(LOCK_FILE, "utf8")).groups;
const lockedById = new Map(locked.map((g) => [g.id, g]));
const changes = [];

for (const g of shape) {
  const was = lockedById.get(g.id);
  if (!was) {
    changes.push(`  new group "${g.id}" (${g.variantCount} variants)`);
    continue;
  }
  if (was.variantCount !== g.variantCount) {
    changes.push(
      `  ${g.id}: ${was.variantCount} -> ${g.variantCount} variants ` +
      `(${was.identical ? "was identical" : "was divergent"}, ` +
      `${g.identical ? "now identical" : "now divergent"})`
    );
    continue;
  }
  if (JSON.stringify(was.variants) !== JSON.stringify(g.variants)) {
    changes.push(
      `  ${g.id}: same variant count, but grouped differently\n` +
      `      locked:  ${JSON.stringify(was.variants)}\n` +
      `      current: ${JSON.stringify(g.variants)}`
    );
  }
}
for (const was of locked) {
  if (!shape.some((g) => g.id === was.id)) changes.push(`  group "${was.id}" disappeared`);
}

if (!changes.length) {
  console.log("Divergence shape matches the lockfile.");
  process.exit(0);
}

console.error(
  `\nDivergence shape changed in ${changes.length} group${changes.length === 1 ? "" : "s"}:\n`
);
for (const c of changes) console.error(c);
console.error(
  `\nIf this was intended, record it with \`npm run lint:lexias -- --write-lock\`\n` +
  `and commit ${LOCK_FILE} alongside the content change.\n`
);
process.exit(1);
