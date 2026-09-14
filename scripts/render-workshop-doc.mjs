#!/usr/bin/env node
/**
 * Regenerate the single workshop-style policy document from the lexia tree.
 *
 * The inverse of scripts/migrate-lexias.mjs. Exploding one document into 68 files made
 * the text reviewable; this puts it back together, because the workshop still needs a
 * document -- something to print, hand round a room, and send to someone who does not
 * want a git checkout.
 *
 * Output goes to dist/ (gitignored), not to src/sources/. The frozen v5 file must stay
 * exactly as the June 10 workshop produced it; overwriting it would destroy the
 * provenance that `npm run drift` measures against.
 *
 * REGRESSION TEST: with an unedited tree, --check asserts the output is byte-identical to
 * the frozen v5 document apart from the deliberate differences listed below. A renderer
 * that is even slightly lossy means the printed packet is not the same document as the
 * website, which is the kind of divergence nobody notices until a stakeholder reads both.
 *
 * Deliberate differences from the frozen file:
 *   - the `Zip:` violation-arc line, which names an employee that has no block
 *     (BUILD-SPEC 4.2, 12.2) and therefore has no file in content/employees/
 *   - `version:` and `date:`, which now come from content/meta.json
 *
 * Usage:
 *   npm run workshop-doc            write dist/workshop-policy-texts.md
 *   npm run workshop-doc -- --check compare against the frozen v5 document, exit 1 on drift
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { CONFIG_LINE_ORDER, PARAGRAPH_ORDER } from "./lib/taxonomy.mjs";
import { readFlavors, readEmployees, readLexias, lexiaId } from "./lib/lexias.mjs";

const FROZEN_V5 = "src/sources/workshop-1-policy-texts-v5.md";
const OUT_DIR = "dist";
const OUT_FILE = `${OUT_DIR}/workshop-policy-texts.md`;

const check = process.argv.includes("--check");

const TITLE = "Workshop 1 Policy Texts";
const LEDE =
  "Sixteen policy texts. Four employees, four flavors each. Plain language. " +
  "No em dashes. Parallel structure held across all four variants of each employee.";

function render() {
  const meta = JSON.parse(readFileSync("content/meta.json", "utf8"));
  const flavors = readFlavors();
  const employees = readEmployees();
  const lexias = readLexias();

  const out = [];

  // --- Frontmatter ---------------------------------------------------------
  // The violation arc is reassembled from each employee file rather than stored as prose,
  // so it cannot drift out of step with the verdicts the site actually renders.
  out.push("---");
  out.push(`title: ${TITLE}`);
  out.push(`version: ${meta.version}`);
  out.push(`date: ${meta.date}`);
  out.push("project: county-ai (Herkimer)");
  out.push("type: exercise material");
  out.push("status: ready for print");
  out.push("violation arc:");
  for (const e of employees) out.push(`  ${e.name}: ${arcLine(e, flavors)}`);
  out.push("---");
  out.push("");

  // --- Title and lede ------------------------------------------------------
  out.push(`# ${TITLE}`);
  out.push("");
  out.push(LEDE);
  out.push("");
  out.push("---");
  out.push("");

  // --- Employees -----------------------------------------------------------
  for (const [ei, e] of employees.entries()) {
    out.push(`## Employee ${e.number}: ${e.name}, ${e.role}`);
    out.push("");
    out.push(`**The scenario.** ${e.scenario}`);
    out.push("");
    out.push(`**The violation question:** ${e.violationQuestion}`);
    out.push("");
    out.push("---");
    out.push("");

    for (const [fi, f] of flavors.entries()) {
      out.push(`### Employee ${e.number} / ${f.name}: ${f.label}`);
      out.push(CONFIG_LINE_ORDER.map((d) => `${cap(d)} ${f.dimensions[d]}`).join(" | "));
      out.push("");

      for (const dimension of PARAGRAPH_ORDER) {
        const id = lexiaId(e.id, f.id, dimension);
        const lexia = lexias.get(id);
        if (!lexia) throw new Error(`Missing lexia: ${id}`);
        out.push(lexia.text);
        out.push("");
      }

      // The final flavor of the final employee ends the document; every other section is
      // followed by a rule.
      const isLast = ei === employees.length - 1 && fi === flavors.length - 1;
      if (!isLast) {
        out.push("---");
        out.push("");
      }
    }
  }

  return out.join("\n");
}

/** `Security (data left county systems) -- clean on Yellow` */
function arcLine(e, flavors) {
  const byId = new Map(flavors.map((f) => [f.id, f]));
  const names = e.compliantUnder.map((id) => byId.get(id)?.name ?? id);
  const dimension =
    e.violatedDimension === "all" ? "all four dimensions, one per flavor" : cap(e.violatedDimension);
  const detail = ARC_DETAIL[e.id] ? ` (${ARC_DETAIL[e.id]})` : "";
  const only = names.length === 1 && e.violatedDimension === "all" ? " only" : "";
  return `${dimension}${detail} -- clean on ${names.join("/")}${only}`;
}

/**
 * The parenthetical in each arc line is editorial shorthand for *how* the scenario
 * violates its dimension. It is not derivable from the coordinates, so it is carried here
 * rather than invented. Keyed by employee; extend when an employee is added.
 */
const ARC_DETAIL = {
  lux: "data left county systems",
  puk: "acted without confirmation",
  jam: "no log"
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------

const text = render();

if (!check) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, text);
  console.log(`Wrote ${OUT_FILE} (${text.split("\n").length} lines).`);
  process.exit(0);
}

// --- Regression check -------------------------------------------------------

if (!existsSync(FROZEN_V5)) {
  console.error(`Missing ${FROZEN_V5}; nothing to check against.`);
  process.exit(1);
}

const frozen = readFileSync(FROZEN_V5, "utf8");
const ours = text;

const IGNORABLE = [
  /^\s*Zip:/, // no employee block, so no file in content/employees/
  /^version:/, // now from content/meta.json
  /^date:/ // now from content/meta.json
];

const a = frozen.split("\n");
const b = ours.split("\n");
const diffs = [];
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  const x = a[i] ?? "<missing>";
  const y = b[i] ?? "<missing>";
  if (x === y) continue;
  if (IGNORABLE.some((re) => re.test(x) || re.test(y))) continue;
  diffs.push({ line: i + 1, frozen: x, ours: y });
}

// The Zip line means our output is one line shorter; tolerate that offset only if every
// other line matches after removing ignorable lines.
if (diffs.length) {
  const strip = (lines) => lines.filter((l) => !IGNORABLE.some((re) => re.test(l)));
  const sa = strip(a);
  const sb = strip(b);
  const realDiffs = [];
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if ((sa[i] ?? "<missing>") !== (sb[i] ?? "<missing>")) {
      realDiffs.push({ line: i + 1, frozen: sa[i] ?? "<missing>", ours: sb[i] ?? "<missing>" });
    }
  }
  if (!realDiffs.length) {
    console.log(
      "Round-trip OK: the rendered document matches the frozen v5 document,\n" +
      "apart from the Zip arc line and the version/date fields."
    );
    process.exit(0);
  }
  console.error(
    `\nRendered document differs from ${FROZEN_V5} in ${realDiffs.length} line(s) ` +
    `beyond the expected version/date/Zip differences:\n`
  );
  for (const d of realDiffs.slice(0, 12)) {
    console.error(`  line ${d.line}`);
    console.error(`    frozen: ${JSON.stringify(clip(d.frozen))}`);
    console.error(`    ours:   ${JSON.stringify(clip(d.ours))}`);
  }
  if (realDiffs.length > 12) console.error(`  ... and ${realDiffs.length - 12} more`);
  console.error("");
  process.exit(1);
}

console.log("Round-trip OK: the rendered document matches the frozen v5 document exactly.");

function clip(s, n = 96) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
