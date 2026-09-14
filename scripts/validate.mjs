#!/usr/bin/env node
/**
 * Consistency checks on data.json and the content/ tree, per docs/BUILD-SPEC.md 5.3.
 *
 * Checks 1-8 are the original data.json checks. Checks 9-16 cover the lexia tree that
 * replaced the monolithic v5 source document as the authoring format.
 *
 * Two deliberate design choices here:
 *
 *   - Expected configurations are keyed by POSTURE (guardrails, enable, lighttouch,
 *     exposed), never by colour. Postures and their Hi/Lo coordinates are stable; the
 *     colour labelling them is not, and has already been reassigned once upstream. Keying
 *     by posture means a relabelling cannot quietly redefine what "Guardrails" means, and
 *     needs no edit to this file.
 *   - Anything that varies by colour is derived from content/flavors.json rather than
 *     hard-coded, for the same reason.
 *
 * All errors are collected before exiting, so one run surfaces everything wrong rather
 * than one problem at a time.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { EMPLOYEE_IDS, PARAGRAPH_ORDER, DIMENSION_IDS } from "./lib/taxonomy.mjs";
import { LEXIA_DIR, STATUSES, lexiaId, readFlavors, readLexias } from "./lib/lexias.mjs";
import { buildData } from "./build-data.mjs";

/**
 * The four policy postures and their coordinates (BUILD-SPEC 4.1.6). Colour-independent
 * on purpose: see the file header.
 */
const EXPECTED_POSTURE_CONFIG = {
  guardrails: { security: "Hi", accountability: "Hi", efficiency: "Lo", innovation: "Lo" },
  enable: { security: "Hi", accountability: "Hi", efficiency: "Hi", innovation: "Hi" },
  lighttouch: { security: "Hi", accountability: "Lo", efficiency: "Hi", innovation: "Hi" },
  exposed: { security: "Lo", accountability: "Lo", efficiency: "Hi", innovation: "Hi" }
};

/**
 * Which postures each employee's scenario is compliant under (BUILD-SPEC 4.2, the
 * violation arc). Pinned by posture, so that a colour reassignment which forgets to
 * remap `compliantUnder` in content/employees/*.md fails loudly here.
 *
 * This is the single most consequential thing the validator guards. These verdicts drive
 * the Compliant/Violation banner on all 16 job pages, all 21 PDFs, and the overview grid.
 * Nothing about a wrong verdict looks broken -- it just teaches the opposite lesson.
 */
const EXPECTED_COMPLIANT_POSTURES = {
  lux: ["exposed"],
  puk: ["enable", "lighttouch", "exposed"],
  jam: ["lighttouch", "exposed"],
  wow: ["exposed"]
};

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

if (!existsSync("data.json")) {
  console.error("No data.json. Run `npm run build:data` first.");
  process.exit(1);
}

/**
 * Checks run against data REBUILT from content/, not against the committed data.json.
 * The content tree is the source of truth, so validating the artifact would let a stale
 * artifact mask a real content error -- the checks would happily confirm yesterday's
 * correct data while today's tree was broken. Staleness is reported separately as its own
 * error (check 17).
 */
const committed = JSON.parse(readFileSync("data.json", "utf8"));

let data = committed;
let rebuildError = null;
try {
  data = buildData().data;
} catch (err) {
  rebuildError = err;
  fail(`Could not build data from content/: ${err.message}`);
}

const flavorDefs = readFlavors();
const FLAVOR_IDS = flavorDefs.map((f) => f.id);
const flavorById = new Map(flavorDefs.map((f) => [f.id, f]));

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

// --- 5. Flavor configuration is coherent and matches the posture table ------
// Was a re-scan of the v5 source's 16 config lines. Now checks content/flavors.json,
// the single authority, against the posture coordinates -- and separately checks all 64
// lexia `setting` values against it (check 13), which is 64 assertions where the old
// check made 16.

const seenPostures = new Set();
for (const f of flavorDefs) {
  if (!f.posture) {
    fail(`content/flavors.json: flavor "${f.id}" has no posture.`);
    continue;
  }
  if (seenPostures.has(f.posture)) {
    fail(`content/flavors.json: posture "${f.posture}" is used by more than one flavor.`);
  }
  seenPostures.add(f.posture);

  const expected = EXPECTED_POSTURE_CONFIG[f.posture];
  if (!expected) {
    fail(`content/flavors.json: flavor "${f.id}" has unknown posture "${f.posture}".`);
    continue;
  }
  for (const dim of DIMENSION_IDS) {
    if (f.dimensions?.[dim] !== expected[dim]) {
      fail(
        `content/flavors.json: flavor "${f.id}" (posture ${f.posture}) has ${dim} ` +
        `"${f.dimensions?.[dim]}", expected "${expected[dim]}" per BUILD-SPEC 4.1.6.`
      );
    }
  }
}
for (const posture of Object.keys(EXPECTED_POSTURE_CONFIG)) {
  if (!seenPostures.has(posture)) {
    fail(`content/flavors.json: no flavor carries the "${posture}" posture.`);
  }
}

// The collapsed copy in data.json must agree with content/flavors.json.
for (const f of data.flavors) {
  const def = flavorById.get(f.id);
  if (!def) {
    fail(`data.json flavor "${f.id}" is not in content/flavors.json.`);
    continue;
  }
  for (const dim of DIMENSION_IDS) {
    if (f.dimensions[dim] !== def.dimensions[dim]) {
      fail(
        `data.json flavor "${f.id}": ${dim} is "${f.dimensions[dim]}", ` +
        `content/flavors.json says "${def.dimensions[dim]}". Run \`npm run build:data\`.`
      );
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

// --- 7. Accountability-Hi paragraphs contain "not the AI tool" --------------
// The flavor list is derived, not hard-coded: the clause belongs to the *setting*, so a
// colour reassignment must not be able to point this check at the wrong two flavors.

const accountabilityHiFlavors = flavorDefs
  .filter((f) => f.dimensions.accountability === "Hi")
  .map((f) => f.id);

for (const e of data.employees) {
  for (const fid of accountabilityHiFlavors) {
    const p = e.policies[fid]?.paragraphs?.find((x) => x.dimension === "accountability");
    if (!p) continue;
    if (!p.text.includes("not the AI tool")) {
      fail(
        `Employee "${e.id}" / ${fid} / accountability: missing required substring ` +
        `"not the AI tool" (BUILD-SPEC 5.3.7; this was a known v5 fix, regression here ` +
        `is silent and serious).`
      );
    }
  }
}

// --- 8. Warn on violation-arc names with no employee ------------------------
// The one remaining intentional read of the frozen v5 document. "Zip" is a real artifact
// of the June 10 workshop that has no employee block; losing that fact silently would be
// worse than an annoying warning, so the warning outlives the file's retirement as an
// authoring format.

const FROZEN_V5 = "src/sources/workshop-1-policy-texts-v5.md";
if (existsSync(FROZEN_V5)) {
  const text = readFileSync(FROZEN_V5, "utf8");
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

// ---------------------------------------------------------------------------
// Checks 9-16: the lexia tree (BUILD-SPEC 4.4).
// ---------------------------------------------------------------------------

let lexias = new Map();
if (!existsSync(LEXIA_DIR)) {
  fail(`Missing ${LEXIA_DIR}/. Run \`npm run migrate\`.`);
} else {
  lexias = readLexias();

  // --- 9. Exactly 64 files, and nothing else in the directory ---------------

  const entries = readdirSync(LEXIA_DIR);
  const stray = entries.filter((f) => !f.endsWith(".md"));
  for (const f of stray) fail(`${LEXIA_DIR}/${f} is not a lexia file.`);

  const expectedCount = EMPLOYEE_IDS.length * FLAVOR_IDS.length * DIMENSION_IDS.length;
  const mdCount = entries.length - stray.length;
  if (mdCount !== expectedCount) {
    fail(`Expected ${expectedCount} lexias in ${LEXIA_DIR}/, found ${mdCount}.`);
  }

  // --- 10. Every (employee, flavor, dimension) triple exactly once -----------
  // Missing and duplicate are reported separately: a rename collision shows up as a
  // *missing* triple, and saying so points at the actual mistake.

  const seenIds = new Map();
  for (const lexia of lexias.values()) {
    seenIds.set(lexia.id, (seenIds.get(lexia.id) ?? 0) + 1);
  }
  for (const eid of EMPLOYEE_IDS) {
    for (const fid of FLAVOR_IDS) {
      for (const dim of DIMENSION_IDS) {
        const id = lexiaId(eid, fid, dim);
        const n = seenIds.get(id) ?? 0;
        if (n === 0) fail(`Missing lexia "${id}" (${LEXIA_DIR}/${id}.md).`);
        else if (n > 1) fail(`Lexia "${id}" is defined ${n} times.`);
      }
    }
  }

  for (const lexia of lexias.values()) {
    const where = lexia.file;

    // --- 11. Frontmatter agrees with the filename --------------------------

    if (lexia.id !== lexia.stem) {
      fail(`${where}: frontmatter id "${lexia.id}" does not match filename "${lexia.stem}".`);
    }
    const derived = lexiaId(lexia.employee, lexia.flavor, lexia.dimension);
    if (derived !== lexia.stem) {
      fail(
        `${where}: employee/flavor/dimension give "${derived}" but the filename is ` +
        `"${lexia.stem}". A copied-and-renamed file usually causes this.`
      );
    }

    // --- 12. Coordinates are in range --------------------------------------

    if (!EMPLOYEE_IDS.includes(lexia.employee)) {
      fail(`${where}: unknown employee "${lexia.employee}".`);
    }
    if (!FLAVOR_IDS.includes(lexia.flavor)) {
      fail(`${where}: unknown flavor "${lexia.flavor}".`);
    }
    if (!DIMENSION_IDS.includes(lexia.dimension)) {
      fail(`${where}: unknown dimension "${lexia.dimension}".`);
    }

    // --- 13. posture and setting agree with content/flavors.json ------------

    const def = flavorById.get(lexia.flavor);
    if (def) {
      if (lexia.posture !== def.posture) {
        fail(
          `${where}: posture "${lexia.posture}" but flavor "${lexia.flavor}" is ` +
          `"${def.posture}" in content/flavors.json.`
        );
      }
      const expectedSetting = def.dimensions[lexia.dimension];
      if (lexia.setting !== expectedSetting) {
        fail(
          `${where}: setting "${lexia.setting}" but flavor "${lexia.flavor}" sets ` +
          `${lexia.dimension} "${expectedSetting}" in content/flavors.json.`
        );
      }
    }

    // --- 14. Review state is coherent --------------------------------------

    if (!STATUSES.includes(lexia.status)) {
      fail(`${where}: status "${lexia.status}" is not one of ${STATUSES.join(", ")}.`);
    }
    if (lexia.status === "approved" || lexia.status === "flagged") {
      if (!String(lexia.reviewer ?? "").trim()) {
        fail(`${where}: status is "${lexia.status}" but reviewer is empty.`);
      }
      const reviewed = String(lexia.reviewed ?? "").trim();
      if (!reviewed) {
        fail(`${where}: status is "${lexia.status}" but reviewed date is empty.`);
      } else if (Number.isNaN(Date.parse(reviewed))) {
        fail(`${where}: reviewed "${reviewed}" is not a date (expected YYYY-MM-DD).`);
      }
    }

    // --- 15. Body contract and the punctuation convention ------------------
    // BUILD-SPEC 4.1.8 was prose guidance while the text lived in one vendored file
    // nobody edited. Now that 64 files are edited by hand in editors that autocorrect,
    // it is enforced.

    if (!lexia.text || !lexia.text.trim()) {
      fail(`${where}: body is empty.`);
    }
    if (/^---\s*$/m.test(lexia.text)) {
      fail(`${where}: body contains a bare "---" line, which would break re-parsing.`);
    }
    const banned = [
      ["—", "em dash"],
      ["–", "en dash"],
      ["‘", "curly opening single quote"],
      ["’", "curly apostrophe"],
      ["“", "curly opening double quote"],
      ["”", "curly closing double quote"]
    ];
    for (const [ch, label] of banned) {
      if (lexia.text.includes(ch)) {
        fail(
          `${where}: body contains a ${label}. The source convention is " -- " and ` +
          `straight quotes (BUILD-SPEC 4.1.8); do not let an editor autocorrect it.`
        );
      }
    }
  }
}

// --- 16. Verdicts still map to the right postures ---------------------------
// Pinned by posture, not colour. If a colour reassignment remaps the flavors but not
// `compliantUnder` in content/employees/*.md, every Compliant/Violation banner on the
// site inverts -- and nothing else would catch it.

for (const e of data.employees) {
  const expected = EXPECTED_COMPLIANT_POSTURES[e.id];
  if (!expected) continue;
  const gotPostures = (e.compliantUnder ?? [])
    .map((fid) => flavorById.get(fid)?.posture ?? `unknown(${fid})`)
    .sort();
  const want = [...expected].sort();
  if (JSON.stringify(gotPostures) !== JSON.stringify(want)) {
    fail(
      `Employee "${e.id}": compliantUnder is [${(e.compliantUnder ?? []).join(", ")}] ` +
      `= postures [${gotPostures.join(", ")}], expected postures [${want.join(", ")}] ` +
      `(BUILD-SPEC 4.2). Check content/employees/${e.id}.md.`
    );
  }
}

// --- 17. The committed data.json is not stale -------------------------------
// A separate finding from the content checks above, and reported as such: "the artifact
// needs rebuilding" and "the content is wrong" are different problems with different
// fixes. Possible only because build-data.mjs is a pure function of the content tree.

if (!rebuildError && JSON.stringify(data) !== JSON.stringify(committed)) {
  fail("data.json is out of date with content/. Run `npm run build:data`.");
}

// --- Report ------------------------------------------------------------------

console.log(
  `${lexias.size} lexias, ${data.employees.length * 4} policies, ` +
  `${data.dimensions.length} dimensions, ` +
  `${errors.length} error${errors.length === 1 ? "" : "s"}, ` +
  `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
);

for (const w of warnings) console.log(`warn   ${w}`);
for (const e of errors) console.log(`error  ${e}`);

process.exit(errors.length > 0 ? 1 : 0);
