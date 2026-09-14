#!/usr/bin/env node
/**
 * Build data.json (and the browser copy at src/assets/data.js) from the content/ tree,
 * plus review.json for the review UI. See docs/BUILD-SPEC.md sections 4.4, 5.1 and 5.4.
 *
 * Replaces scripts/extract.mjs, which parsed the monolithic v5 workshop document.
 *
 * data.json's shape is unchanged and must stay that way: it is the only coupling point
 * between content and the Eleventy templates (src/_data/policy.js and combos.js are
 * three-line re-exports of it), so holding the shape means the content pipeline can be
 * replaced underneath without touching a single template. BUILD-SPEC 5.1 permits no
 * additional top-level keys, which is precisely why review state goes to a second
 * artifact rather than being folded in here.
 *
 * Inputs:
 *   content/meta.json                        version and date of the material
 *   content/flavors.json                     the flavor/posture/Hi-Lo authority
 *   content/employees/*.md                   scenarios, questions, verdicts
 *   content/lexias/*.md                      the 64 policy paragraphs
 *   src/sources/operational-dimension-definitions.md   still vendored from upstream
 *
 * The frozen v5 workshop document is NOT an input. It is provenance, read only by
 * scripts/drift.mjs and by the orphaned-name check in scripts/validate.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseDimensions } from "./lib/parse-definitions.mjs";
import { PARAGRAPH_ORDER } from "./lib/taxonomy.mjs";
import { readFlavors, readEmployees, readLexias, policiesFor, readFrozenV5, frozenKey } from "./lib/lexias.mjs";
import { groupLexias } from "./lib/groups.mjs";

const DEFS_FILE = "src/sources/operational-dimension-definitions.md";
const META_FILE = "content/meta.json";

export function buildData() {
  const meta = JSON.parse(readFileSync(META_FILE, "utf8"));
  const flavorDefs = readFlavors();
  const employees = readEmployees();
  const lexias = readLexias();
  const dimensions = parseDimensions(readFileSync(DEFS_FILE, "utf8"));

  // `posture` is deliberately not emitted: it exists to key lexia frontmatter and to
  // survive a colour relabelling, and `label` already carries the human-readable form.
  const flavors = flavorDefs.map(({ posture, ...f }) => ({ ...f }));

  const data = {
    meta: {
      version: `v${meta.version}`,
      sourceFile: "content/lexias/",
      definitionsFile: "operational-dimension-definitions.md",
      // Tracks the source material, not the clock, so data.json is a pure function of its
      // inputs and its diff stays a reviewable record of content change
      // (TOOLING-AND-DEPLOYMENT 4.4, 4.5).
      generated: meta.date
    },
    dimensions,
    flavors,
    employees: employees.map((e) => ({
      id: e.id,
      number: e.number,
      name: e.name,
      role: e.role,
      scenario: e.scenario,
      violationQuestion: e.violationQuestion,
      violatedDimension: e.violatedDimension,
      compliantUnder: e.compliantUnder,
      policies: policiesFor(e.id, flavors, lexias)
    }))
  };

  return { data, lexias, flavorDefs };
}

export function buildReview({ lexias, flavorDefs }) {
  const { groups, identicalCount, divergentCount } = groupLexias(flavorDefs, lexias);

  const groupOf = new Map();
  for (const g of groups) for (const id of g.memberIds) groupOf.set(id, g.id);

  // Badge each lexia against the frozen workshop document, so a reviewer can see at a
  // glance which paragraphs are still the room's own words. `npm run drift` reports the
  // same comparison in detail.
  const frozen = readFrozenV5();
  const driftOf = (lexia) => {
    if (!frozen) return "unknown";
    const key = frozenKey(lexia);
    if (!frozen.has(key)) return "added";
    return frozen.get(key) === lexia.text ? "identical" : "changed";
  };

  const rows = [...lexias.values()]
    .map((l) => ({
      id: l.id,
      employee: l.employee,
      flavor: l.flavor,
      posture: l.posture,
      dimension: l.dimension,
      setting: l.setting,
      status: l.status ?? "unreviewed",
      reviewer: l.reviewer ?? "",
      reviewed: l.reviewed ?? "",
      notes: l.notes ?? "",
      tags: l.tags ?? [],
      rationale: l.rationale ?? "",
      implementationNote: l.implementation_note ?? "",
      text: l.text,
      words: l.text.split(/\s+/).filter(Boolean).length,
      groupId: groupOf.get(l.id) ?? null,
      driftFromV5: driftOf(l)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const statusCounts = {};
  for (const r of rows) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;

  return {
    meta: {
      lexiaCount: rows.length,
      groupCount: groups.length,
      identicalGroups: identicalCount,
      divergentGroups: divergentCount
    },
    statusCounts,
    lexias: rows,
    groups
  };
}

function main() {
  const built = buildData();
  const review = buildReview(built);

  writeFileSync("data.json", JSON.stringify(built.data, null, 2) + "\n");
  writeFileSync("review.json", JSON.stringify(review, null, 2) + "\n");
  writeFileSync(
    "src/assets/data.js",
    `window.COUNTY_AI_DATA = ${JSON.stringify(built.data, null, 2)};\n`
  );

  console.log(
    `Wrote data.json, review.json and src/assets/data.js: ` +
    `${built.data.employees.length} employees, ${built.data.flavors.length} flavors, ` +
    `${built.data.dimensions.length} dimensions, ${review.meta.lexiaCount} lexias ` +
    `(${review.meta.divergentGroups} divergent groups of ${review.meta.groupCount}).`
  );
}

// Only run when invoked directly, so migrate-lexias.mjs can import buildData() to verify
// its own output without triggering a write.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
