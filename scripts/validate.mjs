#!/usr/bin/env node
/**
 * Consistency checks on data.json, per docs/BUILD-SPEC.md section 5.3.
 *
 * Checks 5 and 8 concern structure that does not survive into data.json's
 * final schema (per-employee dimension configs are collapsed into the shared
 * `flavors` array; the orphaned violation-arc name is dropped entirely), so
 * those two re-scan the vendored source text directly rather than data.json.
 *
 * Exits non-zero with a specific message on the first category of failure it
 * finds, after collecting every error in that category so one run surfaces
 * everything wrong rather than one problem at a time.
 */
import { readFileSync, existsSync } from "node:fs";

const EMPLOYEE_IDS = ["lux", "puk", "jam", "wow"];
const FLAVOR_IDS = ["green", "red", "blue", "yellow"];
const PARAGRAPH_ORDER = ["security", "efficiency", "innovation", "accountability"];
const DIMENSION_IDS = ["security", "accountability", "efficiency", "innovation"];

// Expected per BUILD-SPEC 4.1.6.
const EXPECTED_FLAVOR_CONFIG = {
  green: { security: "Hi", accountability: "Hi", efficiency: "Lo", innovation: "Lo" },
  red: { security: "Hi", accountability: "Hi", efficiency: "Hi", innovation: "Hi" },
  blue: { security: "Hi", accountability: "Lo", efficiency: "Hi", innovation: "Hi" },
  yellow: { security: "Lo", accountability: "Lo", efficiency: "Hi", innovation: "Hi" }
};

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

if (!existsSync("data.json")) {
  console.error("No data.json. Run `npm run extract` first.");
  process.exit(1);
}

const data = JSON.parse(readFileSync("data.json", "utf8"));

// --- 1. Exactly 4 employees, correct ids ------------------------------------

const gotIds = data.employees.map((e) => e.id);
if (gotIds.length !== 4) {
  fail(`Expected 4 employees, found ${gotIds.length} (${gotIds.join(", ")}).`);
}
for (const id of EMPLOYEE_IDS) {
  if (!gotIds.includes(id)) fail(`Missing expected employee "${id}".`);
}
for (const id of gotIds) {
  if (!EMPLOYEE_IDS.includes(id)) fail(`Unexpected employee "${id}".`);
}

// --- 2, 3, 4. Flavors, paragraph count/order, paragraph length -------------

for (const e of data.employees) {
  const flavorIds = Object.keys(e.policies);
  if (flavorIds.length !== 4) {
    fail(`Employee "${e.id}": expected 4 flavors, found ${flavorIds.length}.`);
  }
  for (const fid of FLAVOR_IDS) {
    if (!(fid in e.policies)) {
      fail(`Employee "${e.id}": missing flavor "${fid}".`);
      continue;
    }
    const paragraphs = e.policies[fid].paragraphs;
    if (!paragraphs || paragraphs.length !== 4) {
      fail(`Employee "${e.id}" / ${fid}: expected 4 paragraphs, found ${paragraphs?.length ?? 0}.`);
      continue;
    }
    paragraphs.forEach((p, i) => {
      if (p.dimension !== PARAGRAPH_ORDER[i]) {
        fail(
          `Employee "${e.id}" / ${fid}: paragraph ${i} has dimension "${p.dimension}", ` +
          `expected "${PARAGRAPH_ORDER[i]}" (BUILD-SPEC 5.2.6 order).`
        );
      }
      if (!p.text || p.text.trim().length <= 40) {
        fail(
          `Employee "${e.id}" / ${fid} / ${p.dimension}: paragraph text is empty or too short ` +
          `(${p.text?.trim().length ?? 0} chars, need > 40).`
        );
      }
    });
  }
}

// --- 5. Identical dimension config per flavor across employees -------------
// Re-scanned from the source: data.json's `flavors` array only records one
// (already-collapsed) config per flavor, so this check re-derives each
// employee's config independently to confirm collapsing it lost nothing.

const SOURCE_FILE = "src/sources/workshop-1-policy-texts-v5.md";
if (!existsSync(SOURCE_FILE)) {
  fail(`Missing vendored source ${SOURCE_FILE}; cannot cross-check dimension configs.`);
} else {
  const text = readFileSync(SOURCE_FILE, "utf8");
  const flavorHeaderRe = /^### Employee (\d+) \/ (\w+): .+\n(.+)$/gm;
  const seen = {}; // flavorId -> config
  for (const m of text.matchAll(flavorHeaderRe)) {
    const flavorId = m[2].trim().toLowerCase();
    const configLine = m[3];
    const config = {};
    for (const cm of configLine.matchAll(/(\w+)\s+(Hi|Lo)/g)) {
      config[cm[1].toLowerCase()] = cm[2];
    }
    const key = JSON.stringify(config);
    if (!(flavorId in seen)) seen[flavorId] = key;
    else if (seen[flavorId] !== key) {
      fail(`Flavor "${flavorId}": dimension config differs between employees (employee ${m[1]}).`);
    }
  }
  for (const fid of FLAVOR_IDS) {
    const expected = JSON.stringify(EXPECTED_FLAVOR_CONFIG[fid]);
    if (seen[fid] && seen[fid] !== expected) {
      fail(
        `Flavor "${fid}": source config ${seen[fid]} does not match the table in ` +
        `BUILD-SPEC 4.1.6 (${expected}).`
      );
    }
  }
  // Also check the collapsed data.json copy agrees.
  for (const f of data.flavors) {
    const expected = EXPECTED_FLAVOR_CONFIG[f.id];
    for (const dim of DIMENSION_IDS) {
      if (f.dimensions[dim] !== expected[dim]) {
        fail(`data.json flavor "${f.id}": dimension "${dim}" is "${f.dimensions[dim]}", expected "${expected[dim]}".`);
      }
    }
  }
}

// --- 6. Exactly 4 dimensions, non-empty hi/lo/operativeQuestion -------------

if (data.dimensions.length !== 4) {
  fail(`Expected 4 dimensions, found ${data.dimensions.length}.`);
}
for (const id of DIMENSION_IDS) {
  const d = data.dimensions.find((x) => x.id === id);
  if (!d) {
    fail(`Missing dimension "${id}".`);
    continue;
  }
  if (!d.hi || d.hi.trim().length === 0) fail(`Dimension "${id}": empty "hi" text.`);
  if (!d.lo || d.lo.trim().length === 0) fail(`Dimension "${id}": empty "lo" text.`);
  if (!d.operativeQuestion || !d.operativeQuestion.trim().endsWith("?")) {
    fail(`Dimension "${id}": operativeQuestion missing or does not end in "?".`);
  }
}

// --- 7. Accountability Hi paragraphs (Green, Red) contain "not the AI tool" -

for (const e of data.employees) {
  for (const fid of ["green", "red"]) {
    const p = e.policies[fid]?.paragraphs?.find((x) => x.dimension === "accountability");
    if (!p) continue;
    if (!p.text.includes("not the AI tool")) {
      fail(
        `Employee "${e.id}" / ${fid} / accountability: missing required substring "not the AI tool" ` +
        `(BUILD-SPEC 5.3.7; this was a known v5 fix, regression here is silent and serious).`
      );
    }
  }
}

// --- 8. Warn (do not fail) on violation-arc names with no employee block ---

const POLICY_FILE = "src/sources/workshop-1-policy-texts-v5.md";
if (existsSync(POLICY_FILE)) {
  const text = readFileSync(POLICY_FILE, "utf8");
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
  const arcMatch = fmMatch?.[1].match(/violation arc:\n([\s\S]*?)(?:\n\S|\n*$)/);
  if (arcMatch) {
    const names = [...arcMatch[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    const knownNames = new Set(data.employees.map((e) => e.name));
    for (const name of names) {
      if (!knownNames.has(name)) {
        warnings.push(
          `Violation arc names "${name}" but no employee block exists for it in the source ` +
          `(BUILD-SPEC 4.2, 12.2; expected for "Zip", not a build failure).`
        );
      }
    }
  }
}

// --- Report ------------------------------------------------------------------

console.log(
  `${data.employees.length * 4} policies, ${data.dimensions.length} dimensions, ` +
  `${errors.length} error${errors.length === 1 ? "" : "s"}, ` +
  `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
);

for (const w of warnings) console.log(`warn   ${w}`);
for (const e of errors) console.log(`error  ${e}`);

process.exit(errors.length > 0 ? 1 : 0);
