/**
 * Read and write the content/ tree: flavors, employees, and the 64 lexias.
 * See docs/BUILD-SPEC.md section 4.4.
 *
 * A "lexia" is one policy paragraph: the text that applies to one employee, under one
 * policy flavor, for one operational dimension. 4 employees x 4 flavors x 4 dimensions =
 * 64 cells, one file each.
 *
 * The body of a lexia file is the policy text and nothing else -- no headings, no notes.
 * That contract is what keeps `npm run drift` a plain string comparison and what protects
 * the ` -- ` double-hyphen convention (BUILD-SPEC 4.1.8) from being normalized by an
 * editor that thinks it is being helpful.
 *
 * Frontmatter is written by hand rather than via gray-matter's stringify so that key
 * order, block-scalar style, and blank-line grouping stay stable across rewrites. An
 * unstable emitter would make every `npm run build:data` produce spurious diffs, which is
 * the same problem the meta.generated fix in build-data.mjs was solving.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import matter from "gray-matter";
import { PARAGRAPH_ORDER, EMPLOYEE_IDS } from "./taxonomy.mjs";
import { splitFrontmatter } from "./frontmatter.mjs";
import { parseViolationArc, parseEmployees } from "./parse-v5.mjs";

export const CONTENT_DIR = "content";
export const LEXIA_DIR = `${CONTENT_DIR}/lexias`;
export const EMPLOYEE_DIR = `${CONTENT_DIR}/employees`;
export const FLAVORS_FILE = `${CONTENT_DIR}/flavors.json`;

export const STATUSES = ["unreviewed", "in-review", "approved", "flagged"];

/** `<employee>-<flavor>-<dimension>` */
export function lexiaId(employee, flavor, dimension) {
  return `${employee}-${flavor}-${dimension}`;
}

export function lexiaPath(id) {
  return `${LEXIA_DIR}/${id}.md`;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function readFlavors() {
  return JSON.parse(readFileSync(FLAVORS_FILE, "utf8"));
}

export function readEmployees() {
  const employees = [];
  for (const id of EMPLOYEE_IDS) {
    const file = `${EMPLOYEE_DIR}/${id}.md`;
    if (!existsSync(file)) throw new Error(`Missing employee file: ${file}`);
    const { data, content } = matter(readFileSync(file, "utf8"));

    const scenario = sectionBody(content, "Scenario");
    const violationQuestion = sectionBody(content, "Violation question");
    if (!scenario) throw new Error(`${file}: no "## Scenario" section.`);
    if (!violationQuestion) throw new Error(`${file}: no "## Violation question" section.`);

    employees.push({
      id: data.id,
      number: data.number,
      name: data.name,
      role: data.role,
      scenario,
      violationQuestion,
      violatedDimension: data.violatedDimension,
      compliantUnder: data.compliantUnder ?? [],
      file
    });
  }
  return employees.sort((a, b) => a.number - b.number);
}

/** Pull the text under a `## Heading` up to the next `## ` or end of file. */
function sectionBody(content, heading) {
  const re = new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |\\s*$(?![\\s\\S]))`, "m");
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Every lexia file, keyed by id. Read order is filesystem order and is NOT meaningful --
 * callers must impose PARAGRAPH_ORDER when emitting (BUILD-SPEC 4.1.5). Sorting these
 * filenames alphabetically would put `accountability` first and silently reorder every
 * policy page.
 */
export function readLexias() {
  if (!existsSync(LEXIA_DIR)) throw new Error(`Missing ${LEXIA_DIR}/`);
  const byId = new Map();
  for (const entry of readdirSync(LEXIA_DIR)) {
    if (!entry.endsWith(".md")) continue;
    const file = `${LEXIA_DIR}/${entry}`;
    const { data, content } = matter(readFileSync(file, "utf8"));
    byId.set(data.id ?? entry.replace(/\.md$/, ""), {
      ...data,
      // YAML parses an unquoted `reviewed: 2026-09-14` into a Date, which serialises
      // into review.json as a full ISO timestamp and renders as one. Normalise back to
      // the plain date the file actually contains.
      reviewed: dateOnly(data.reviewed),
      text: stripBody(content),
      file,
      stem: entry.replace(/\.md$/, "")
    });
  }
  return byId;
}

/**
 * The body contract: strip leading and trailing newlines only. Interior whitespace is
 * left exactly as written.
 */
export function stripBody(content) {
  return content.replace(/^\n+/, "").replace(/\n+$/, "");
}

/** A `YYYY-MM-DD` string, whether YAML handed us a Date or a string. */
export function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * The 64 original paragraph texts from the frozen v5 workshop document, keyed by lexia id.
 * Returns null when the document is absent, so a checkout without it still builds.
 *
 * Used to badge each lexia identical/changed in review.json, and by scripts/drift.mjs.
 */
export function readFrozenV5() {
  const file = "src/sources/workshop-1-policy-texts-v5.md";
  if (!existsSync(file)) return null;
  const { frontmatter, body } = splitFrontmatter(readFileSync(file, "utf8"));
  const original = new Map();
  for (const e of parseEmployees(body, parseViolationArc(frontmatter))) {
    for (const [flavorId, policy] of Object.entries(e.policies)) {
      for (const p of policy.paragraphs) {
        original.set(lexiaId(e.id, flavorId, p.dimension), p.text);
      }
    }
  }
  return original;
}

/**
 * Assemble the nested `employee.policies[flavor].paragraphs` structure that data.json
 * expects, in PARAGRAPH_ORDER. Throws on a missing cell rather than emitting a short
 * paragraph array, so a lost file fails loudly here instead of quietly in a template.
 */
export function policiesFor(employeeId, flavors, lexias) {
  const policies = {};
  for (const f of flavors) {
    policies[f.id] = {
      paragraphs: PARAGRAPH_ORDER.map((dimension) => {
        const id = lexiaId(employeeId, f.id, dimension);
        const lexia = lexias.get(id);
        if (!lexia) throw new Error(`Missing lexia: ${lexiaPath(id)}`);
        return { dimension, text: lexia.text };
      })
    };
  }
  return policies;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Quote a scalar only when YAML would otherwise misread it. */
function scalar(value) {
  if (value === null || value === undefined || value === "") return '""';
  const s = String(value);
  return /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/.test(s) ? s : JSON.stringify(s);
}

/** Emit a `key: |` block scalar, indented two spaces. Empty stays empty but present. */
function block(key, value) {
  const text = (value ?? "").toString().trim();
  if (!text) return `${key}: |\n`;
  const indented = text.split("\n").map((l) => (l ? `  ${l}` : "")).join("\n");
  return `${key}: |\n${indented}\n`;
}

export function renderLexiaFile(lexia) {
  const tags = (lexia.tags ?? []).map((t) => `  - ${t}`).join("\n");
  const fm =
    `id: ${lexia.id}\n` +
    `employee: ${lexia.employee}\n` +
    `flavor: ${lexia.flavor}\n` +
    `posture: ${lexia.posture}\n` +
    `dimension: ${lexia.dimension}\n` +
    `setting: ${lexia.setting}\n` +
    `\n` +
    `status: ${lexia.status}\n` +
    `reviewer: ${scalar(lexia.reviewer)}\n` +
    `reviewed: ${scalar(lexia.reviewed)}\n` +
    block("notes", lexia.notes) +
    `\n` +
    (tags ? `tags:\n${tags}\n` : `tags: []\n`) +
    `\n` +
    block("rationale", lexia.rationale) +
    block("implementation_note", lexia.implementation_note);

  return `---\n${fm}---\n${lexia.text}\n`;
}

export function writeLexiaFile(lexia) {
  writeFileSync(lexiaPath(lexia.id), renderLexiaFile(lexia));
}

export function renderEmployeeFile(e) {
  const fm =
    `id: ${e.id}\n` +
    `number: ${e.number}\n` +
    `name: ${e.name}\n` +
    `role: ${scalar(e.role)}\n` +
    `violatedDimension: ${e.violatedDimension}\n` +
    `compliantUnder: [${e.compliantUnder.join(", ")}]\n`;

  return (
    `---\n${fm}---\n\n` +
    `## Scenario\n\n${e.scenario}\n\n` +
    `## Violation question\n\n${e.violationQuestion}\n`
  );
}

export function writeEmployeeFile(e) {
  writeFileSync(`${EMPLOYEE_DIR}/${e.id}.md`, renderEmployeeFile(e));
}
