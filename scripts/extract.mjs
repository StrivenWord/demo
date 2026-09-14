#!/usr/bin/env node
/**
 * Parse the vendored markdown sources into data.json, plus a browser-loadable
 * copy at src/assets/data.js. See docs/BUILD-SPEC.md sections 4 and 5.
 *
 * No YAML dependency: the policy-texts frontmatter's `violation arc` block has
 * a key containing a space, which is awkward for strict YAML parsers, so the
 * whole frontmatter is walked by hand instead (BUILD-SPEC 5.2.1).
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = "src/sources";
const POLICY_FILE = `${SOURCES}/workshop-1-policy-texts-v5.md`;
const DEFS_FILE = `${SOURCES}/operational-dimension-definitions.md`;

const DIMENSION_IDS = ["security", "accountability", "efficiency", "innovation"];
const PARAGRAPH_ORDER = ["security", "efficiency", "innovation", "accountability"];

const FLAVORS = [
  { id: "green", name: "Green", label: "Guardrails", character: "Most restrictive; maximum oversight" },
  { id: "red", name: "Red", label: "Enable", character: "Fast and safe; strong logging, open tool adoption" },
  { id: "blue", name: "Blue", label: "Light-touch", character: "Fast with minimal logging; data stays in county systems" },
  { id: "yellow", name: "Yellow", label: "Exposed", character: "Least constrained; highest exposure" }
];

// ---------------------------------------------------------------------------
// Frontmatter: split on the first two `---` lines.
// ---------------------------------------------------------------------------

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("No frontmatter block found.");
  return { frontmatter: m[1], body: m[2] };
}

// ---------------------------------------------------------------------------
// The violation arc (BUILD-SPEC 4.2). Hand-rolled parse: lines under
// "violation arc:" of the form "  Name: <dimension text> -- clean on <list>".
// ---------------------------------------------------------------------------

function parseViolationArc(frontmatter) {
  const block = frontmatter.match(/violation arc:\n([\s\S]*?)(?:\n\S|\n*$)/);
  if (!block) throw new Error("No `violation arc` block in frontmatter.");
  const lines = block[1].split("\n").filter((l) => l.trim().length > 0);

  const arc = {};
  for (const line of lines) {
    const m = line.match(/^\s*(\w+):\s*(.+)$/);
    if (!m) continue;
    const [, name, rest] = m;
    const [violationText, cleanText] = rest.split(/\s*--\s*/);
    const cleanMatch = cleanText.match(/clean on (.+?)(?:\s+only)?$/i);
    const flavorNames = cleanMatch ? cleanMatch[1].split("/").map((s) => s.trim().toLowerCase()) : [];

    let violatedDimension;
    if (/all four/i.test(violationText)) {
      violatedDimension = "all";
    } else {
      const dimMatch = violationText.match(/^(Security|Accountability|Efficiency|Innovation)/i);
      violatedDimension = dimMatch ? dimMatch[1].toLowerCase() : null;
    }

    arc[name] = { violatedDimension, compliantUnder: flavorNames };
  }
  return arc;
}

// ---------------------------------------------------------------------------
// Employee blocks (BUILD-SPEC 5.2.2-5.2.7).
// ---------------------------------------------------------------------------

function parseEmployees(body, arc) {
  const headerRe = /^## Employee (\d+): (.+?), (.+)$/gm;
  const headers = [...body.matchAll(headerRe)];
  const employees = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const start = h.index;
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    const block = body.slice(start, end);

    const number = Number(h[1]);
    const name = h[2].trim();
    const role = h[3].trim();
    const id = name.toLowerCase();

    const scenarioMatch = block.match(/\*\*The scenario\.\*\* ([\s\S]*?)\n\n/);
    if (!scenarioMatch) throw new Error(`No scenario found for employee ${name}.`);
    const scenario = scenarioMatch[1].trim();

    const questionMatch = block.match(/\*\*The violation question:\*\* (.+)/);
    if (!questionMatch) throw new Error(`No violation question found for employee ${name}.`);
    const violationQuestion = questionMatch[1].trim();

    const policies = parseFlavorSections(block, name);

    const arcEntry = arc[name];
    if (!arcEntry) throw new Error(`No violation-arc entry for employee ${name}.`);

    employees.push({
      id,
      number,
      name,
      role,
      scenario,
      violationQuestion,
      violatedDimension: arcEntry.violatedDimension,
      compliantUnder: arcEntry.compliantUnder,
      policies
    });
  }

  return employees;
}

function parseFlavorSections(block, employeeName) {
  const flavorHeaderRe = /^### Employee \d+ \/ (\w+): (.+)$/gm;
  const matches = [...block.matchAll(flavorHeaderRe)];
  if (matches.length !== 4) {
    throw new Error(`Employee ${employeeName}: expected 4 flavor sections, found ${matches.length}.`);
  }

  const policies = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const flavorId = m[1].trim().toLowerCase();
    const sectionStart = m.index + m[0].length;
    const sectionEnd = i + 1 < matches.length ? matches[i + 1].index : block.length;
    let section = block.slice(sectionStart, sectionEnd);

    // Drop a trailing "---" delimiter line, if present, before splitting on
    // blank lines, so it is never mistaken for paragraph content.
    section = section.replace(/\n---\s*$/, "");

    const lines = section.split("\n");
    // First non-empty line is the dimension config line (BUILD-SPEC 5.2.5).
    let idx = 0;
    while (idx < lines.length && lines[idx].trim() === "") idx++;
    const configLine = lines[idx];
    const rest = lines.slice(idx + 1).join("\n");

    const config = {};
    for (const cm of configLine.matchAll(/(\w+)\s+(Hi|Lo)/g)) {
      config[cm[1].toLowerCase()] = cm[2];
    }

    const paragraphs = rest
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p !== "---");

    if (paragraphs.length !== 4) {
      throw new Error(
        `Employee ${employeeName} / ${flavorId}: expected 4 paragraphs, found ${paragraphs.length}.`
      );
    }

    policies[flavorId] = {
      dimensions: config,
      paragraphs: paragraphs.map((text, pi) => ({ dimension: PARAGRAPH_ORDER[pi], text }))
    };
  }

  return policies;
}

// ---------------------------------------------------------------------------
// Dimension definitions (BUILD-SPEC 4.3).
// ---------------------------------------------------------------------------

function parseDimensions(text) {
  const { body } = splitFrontmatter(text);

  // Split into "## Heading" sections; each section's content runs until the
  // next "## " heading (or end of file).
  const sectionRe = /^## (.+)$/gm;
  const matches = [...body.matchAll(sectionRe)];
  const sections = {};
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    sections[name] = body.slice(start, end);
  }

  const names = ["Security", "Accountability", "Efficiency", "Innovation"];
  const dimensions = [];

  for (const name of names) {
    const content = sections[name];
    if (!content) throw new Error(`No "## ${name}" section in definitions file.`);

    const qMatch = content.match(/The operative question is:\s*([^\n]+?\?)/);
    const hiMatch = content.match(/\nHi:\s*([^\n]+)/);
    const loMatch = content.match(/\nLo:\s*([^\n]+)/);
    const provMatch = content.match(/Where this language was built\.\s*([^\n]+)/);
    const alignMatch = content.match(/External alignment\.\s*([^\n]+)/);

    if (!qMatch) throw new Error(`${name}: no operative question found.`);
    if (!hiMatch) throw new Error(`${name}: no Hi: text found.`);
    if (!loMatch) throw new Error(`${name}: no Lo: text found.`);

    dimensions.push({
      id: name.toLowerCase(),
      name,
      operativeQuestion: qMatch[1].trim(),
      hi: hiMatch[1].trim(),
      lo: loMatch[1].trim(),
      provenance: provMatch ? provMatch[1].trim() : "",
      alignment: alignMatch ? alignMatch[1].trim() : ""
    });
  }

  return dimensions;
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

function main() {
  const policyText = readFileSync(POLICY_FILE, "utf8");
  const defsText = readFileSync(DEFS_FILE, "utf8");

  const { frontmatter, body } = splitFrontmatter(policyText);
  const arc = parseViolationArc(frontmatter);
  const employees = parseEmployees(body, arc);
  const dimensions = parseDimensions(defsText);

  // Flavor dimension configs, read off the first employee (BUILD-SPEC 4.1.6:
  // identical across all four employees per flavor; validate.mjs confirms it).
  const flavors = FLAVORS.map((f) => ({
    ...f,
    dimensions: employees[0].policies[f.id].dimensions
  }));

  // Strip the per-employee `dimensions` copy now that it has been promoted to
  // the shared flavor record; keep employee.policies to just `paragraphs`.
  for (const e of employees) {
    for (const fid of Object.keys(e.policies)) {
      e.policies[fid] = { paragraphs: e.policies[fid].paragraphs };
    }
  }

  // data.json carries exactly the top-level keys in BUILD-SPEC 5.1. The
  // orphaned-name check (5.3.8) belongs to validate.mjs, which re-derives it
  // from the source frontmatter rather than smuggling it in here.
  const data = {
    meta: {
      version: "v5",
      sourceFile: "workshop-1-policy-texts-v5.md",
      definitionsFile: "operational-dimension-definitions.md",
      generated: new Date().toISOString().slice(0, 10)
    },
    dimensions,
    flavors,
    employees
  };

  writeFileSync("data.json", JSON.stringify(data, null, 2) + "\n");
  writeFileSync(
    "src/assets/data.js",
    `window.COUNTY_AI_DATA = ${JSON.stringify(data, null, 2)};\n`
  );

  console.log(
    `Wrote data.json and src/assets/data.js: ${employees.length} employees, ` +
    `${flavors.length} flavors, ${dimensions.length} dimensions.`
  );
}

main();
