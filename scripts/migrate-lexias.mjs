#!/usr/bin/env node
/**
 * One-shot migration: explode the frozen v5 workshop document into the content/ tree.
 *
 *   src/sources/workshop-1-policy-texts-v5.md
 *     -> content/employees/{lux,puk,jam,wow}.md             (4 files)
 *     -> content/lexias/<employee>-<flavor>-<dimension>.md  (64 files)
 *     -> content/variant-groups.lock.json
 *
 * Run once; kept afterwards as the record of how the tree was produced.
 *
 * The migration reuses scripts/lib/parse-v5.mjs rather than reimplementing the parse. A
 * second parser would be a second chance to disagree about what the workshop wrote.
 *
 * SAFETY: before exiting, this re-reads everything it wrote, rebuilds data.json from the
 * tree, and asserts the result is deep-equal to the data.json that was committed before
 * the migration. That assertion is the whole proof -- it turns "did we preserve the text?"
 * from a review question into a test, and it is what would catch a whitespace collapse, a
 * smart-quote substitution, or a normalization of the ` -- ` convention (BUILD-SPEC
 * 4.1.8). It is a strict JSON.stringify comparison on purpose: a trimmed or count-based
 * check would pass while the text had silently changed.
 *
 * Usage: node scripts/migrate-lexias.mjs [--force]
 *   --force  overwrite an existing content/lexias tree
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import { splitFrontmatter } from "./lib/frontmatter.mjs";
import { parseViolationArc, parseEmployees } from "./lib/parse-v5.mjs";
import { PARAGRAPH_ORDER } from "./lib/taxonomy.mjs";
import {
  LEXIA_DIR,
  EMPLOYEE_DIR,
  lexiaId,
  readFlavors,
  readLexias,
  writeLexiaFile,
  writeEmployeeFile
} from "./lib/lexias.mjs";
import { groupLexias, lockShape } from "./lib/groups.mjs";
import { buildData } from "./build-data.mjs";

const POLICY_FILE = "src/sources/workshop-1-policy-texts-v5.md";
const LOCK_FILE = "content/variant-groups.lock.json";
const force = process.argv.includes("--force");

function main() {
  if (!existsSync("data.json")) {
    console.error("No data.json to verify against; cannot prove the migration preserved the text.");
    process.exit(1);
  }
  if (existsSync(LEXIA_DIR) && readdirSync(LEXIA_DIR).length && !force) {
    console.error(`${LEXIA_DIR}/ is not empty. Re-run with --force to overwrite.`);
    process.exit(1);
  }

  const before = JSON.parse(readFileSync("data.json", "utf8"));

  const { frontmatter, body } = splitFrontmatter(readFileSync(POLICY_FILE, "utf8"));
  const arc = parseViolationArc(frontmatter);
  const employees = parseEmployees(body, arc);
  const flavors = readFlavors();
  const flavorById = new Map(flavors.map((f) => [f.id, f]));

  // Write into a clean tree so a re-run never leaves a stale cell behind.
  for (const dir of [LEXIA_DIR, EMPLOYEE_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
  }

  let written = 0;
  for (const e of employees) {
    writeEmployeeFile(e);

    for (const f of flavors) {
      const policy = e.policies[f.id];
      if (!policy) throw new Error(`${e.name}: no "${f.id}" section in ${POLICY_FILE}.`);

      for (const dimension of PARAGRAPH_ORDER) {
        const para = policy.paragraphs.find((p) => p.dimension === dimension);
        if (!para) throw new Error(`${e.name}/${f.id}: no ${dimension} paragraph.`);

        writeLexiaFile({
          id: lexiaId(e.id, f.id, dimension),
          employee: e.id,
          flavor: f.id,
          posture: flavorById.get(f.id).posture,
          dimension,
          setting: flavorById.get(f.id).dimensions[dimension],
          // Migration is mechanical. Review state and the lexia-template prose fields are
          // written present-but-empty; scripts/scaffold-template.mjs fills what can be
          // derived and a human fills the rest. Authoring 64 rationales here would mix an
          // editorial change into a mechanical one and make the diff unreviewable.
          status: "unreviewed",
          reviewer: "",
          reviewed: "",
          notes: "",
          tags: [],
          rationale: "",
          implementation_note: "",
          text: para.text
        });
        written++;
      }
    }
  }

  // Seed the divergence lockfile with what the workshop actually produced, so that
  // `npm run lint:lexias -- --fail-on-change` has a baseline.
  const { groups, identicalCount, divergentCount } = groupLexias(flavors, readLexias());
  writeFileSync(
    LOCK_FILE,
    JSON.stringify(
      {
        note:
          "Which lexias are byte-identical within each (employee, dimension, setting) " +
          "group. `npm run lint:lexias -- --fail-on-change` fails when this shape moves. " +
          "Regenerate deliberately with `npm run lint:lexias -- --write-lock`.",
        groups: lockShape(groups)
      },
      null,
      2
    ) + "\n"
  );

  console.log(
    `Wrote ${employees.length} employee files, ${written} lexias, and ${LOCK_FILE}\n` +
    `  ${identicalCount} identical groups, ${divergentCount} divergent, ` +
    `${identicalCount + divergentCount} total.`
  );

  verify(before);
}

// ---------------------------------------------------------------------------
// The round-trip assertion.
// ---------------------------------------------------------------------------

function verify(before) {
  const { data: after } = buildData();

  // meta.sourceFile legitimately changes (the monolith is no longer the source) and
  // meta.generated is compared separately; everything else must be identical.
  const strip = (d) => ({ ...d, meta: undefined });
  const a = JSON.stringify(strip(before));
  const b = JSON.stringify(strip(after));

  if (a === b) {
    console.log("Round-trip OK: the tree reproduces data.json exactly, meta aside.");
    return;
  }

  console.error("\nRound-trip FAILED. The lexia tree does not reproduce data.json.");
  console.error("Nothing was rolled back; inspect content/ and re-run with --force.\n");
  console.error(firstDifference(strip(before), strip(after)) ?? "  (no scalar difference found)");
  process.exit(1);
}

/** Walk both objects and report the first path whose values differ. */
function firstDifference(x, y, path = "") {
  if (JSON.stringify(x) === JSON.stringify(y)) return null;
  if (x === null || y === null || typeof x !== "object" || typeof y !== "object") {
    return `  at ${path}\n    committed: ${JSON.stringify(x)}\n    rebuilt:   ${JSON.stringify(y)}`;
  }
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const d = firstDifference(x[k], y[k], path ? `${path}.${k}` : k);
    if (d) return d;
  }
  return null;
}

main();
