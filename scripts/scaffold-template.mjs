#!/usr/bin/env node
/**
 * Fill the derived `tags` on every lexia. Nothing else is written.
 *
 * `rationale` and `implementation_note` are deliberately left empty. The only
 * non-invented source for them is the canonical Hi/Lo text in
 * src/sources/operational-dimension-definitions.md, and deriving from it produces just
 * eight distinct paragraphs across the sixty-four files -- the Security-Hi text would
 * appear verbatim in twelve of them. A populated `rationale` reads as reviewed content;
 * filling it with a restated definition would mean sixty-four files that look reviewed
 * and are not. They stay empty, tracked by `status`, for a human to write.
 *
 * Tags carry no such risk: every one is a restatement of a coordinate or of the violation
 * arc, both of which are already in the tree.
 *
 *   employee/<id>  flavor/<id>  posture/<p>  dimension/<d>  setting/<hi|lo>
 *   arc/pivot      this dimension is the one the employee's scenario turns on
 *   verdict/<compliant|violation>   whether the employee is compliant under this flavor
 *
 * `arc/pivot` is what makes the tags worth having: it marks the cells where a scenario
 * actually decides a verdict, which is otherwise a manual cross-reference against
 * content/employees/*.md. Note Wow violates "all four dimensions, one per flavor", so
 * every one of Wow's sixteen cells is a pivot.
 *
 * Tags outside these namespaces are preserved, so a tag added by hand -- topic/pii, say --
 * survives a re-run. The script is idempotent.
 *
 * Usage:
 *   npm run scaffold             write derived tags
 *   npm run scaffold -- --check  report files whose derived tags are stale, exit 1 if any
 */
import { readFileSync, writeFileSync } from "node:fs";
import matter from "gray-matter";
import { readFlavors, readEmployees, readLexias, renderLexiaFile } from "./lib/lexias.mjs";

const DERIVED_NAMESPACES = [
  "employee/",
  "flavor/",
  "posture/",
  "dimension/",
  "setting/",
  "arc/",
  "verdict/"
];

const check = process.argv.includes("--check");

const flavors = readFlavors();
const flavorById = new Map(flavors.map((f) => [f.id, f]));
const employees = readEmployees();
const employeeById = new Map(employees.map((e) => [e.id, e]));
const lexias = readLexias();

function derivedTags(lexia) {
  const employee = employeeById.get(lexia.employee);
  const flavor = flavorById.get(lexia.flavor);
  if (!employee || !flavor) return null;

  const isPivot =
    employee.violatedDimension === "all" || employee.violatedDimension === lexia.dimension;
  const isCompliant = (employee.compliantUnder ?? []).includes(lexia.flavor);

  return [
    `employee/${lexia.employee}`,
    `flavor/${lexia.flavor}`,
    `posture/${lexia.posture}`,
    `dimension/${lexia.dimension}`,
    `setting/${String(lexia.setting).toLowerCase()}`,
    ...(isPivot ? ["arc/pivot"] : []),
    `verdict/${isCompliant ? "compliant" : "violation"}`
  ];
}

/** Derived tags replaced; anything in another namespace kept, in its original order. */
function mergeTags(existing, derived) {
  const custom = (existing ?? []).filter(
    (t) => !DERIVED_NAMESPACES.some((ns) => String(t).startsWith(ns))
  );
  return [...derived, ...custom];
}

const stale = [];
let written = 0;

for (const lexia of [...lexias.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const derived = derivedTags(lexia);
  if (!derived) {
    console.error(`${lexia.file}: unknown employee or flavor; skipped.`);
    continue;
  }

  const next = mergeTags(lexia.tags, derived);
  if (JSON.stringify(next) === JSON.stringify(lexia.tags ?? [])) continue;

  stale.push(lexia.id);
  if (check) continue;

  // Re-read through gray-matter so every field is carried across verbatim, rather than
  // trusting the in-memory shape to round-trip.
  const { data, content } = matter(readFileSync(lexia.file, "utf8"));
  writeFileSync(
    lexia.file,
    renderLexiaFile({
      id: data.id,
      employee: data.employee,
      flavor: data.flavor,
      posture: data.posture,
      dimension: data.dimension,
      setting: data.setting,
      status: data.status,
      reviewer: data.reviewer,
      reviewed: data.reviewed,
      notes: data.notes,
      tags: next,
      rationale: data.rationale,
      implementation_note: data.implementation_note,
      text: content.replace(/^\n+/, "").replace(/\n+$/, "")
    })
  );
  written++;
}

if (check) {
  if (!stale.length) {
    console.log(`Derived tags are up to date on all ${lexias.size} lexias.`);
    process.exit(0);
  }
  console.error(
    `\n${stale.length} lexia${stale.length === 1 ? " has" : "s have"} stale derived tags:\n`
  );
  for (const id of stale.slice(0, 12)) console.error(`  ${id}`);
  if (stale.length > 12) console.error(`  ... and ${stale.length - 12} more`);
  console.error(`\nRun \`npm run scaffold\`.\n`);
  process.exit(1);
}

const pivots = [...lexias.values()].filter((l) => derivedTags(l)?.includes("arc/pivot")).length;
const compliant = [...lexias.values()].filter((l) =>
  derivedTags(l)?.includes("verdict/compliant")
).length;

console.log(
  `Tagged ${written} of ${lexias.size} lexias ` +
  `(${lexias.size - written} already current).\n` +
  `  ${pivots} arc/pivot cells, ${compliant} verdict/compliant, ` +
  `${lexias.size - compliant} verdict/violation.\n` +
  `  rationale and implementation_note left empty for review.`
);
