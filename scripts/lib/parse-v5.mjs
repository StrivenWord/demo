/**
 * Parser for the frozen v5 workshop document,
 * `src/sources/workshop-1-policy-texts-v5.md`. See docs/BUILD-SPEC.md section 4.1.
 *
 * This file is the *historical* reader. Once the lexia tree under content/ became the
 * source of truth, the v5 document stopped being an authoring format and became a
 * provenance record. Three things still parse it, deliberately:
 *
 *   - scripts/migrate-lexias.mjs, once, to explode it into the lexia tree
 *   - scripts/drift.mjs, to report how far the lexias have moved from what the June 10
 *     workshop actually produced
 *   - the orphaned-name check in scripts/validate.mjs (BUILD-SPEC 5.3.8, the "Zip" warning)
 *
 * Kept byte-faithful and unchanged from the original scripts/extract.mjs implementation
 * on purpose: a second, subtly different parser would be a second chance to disagree
 * about what the workshop wrote.
 *
 * No YAML dependency here: the frontmatter's `violation arc` block has a key containing a
 * space, which is awkward for strict parsers, so it is walked by hand (BUILD-SPEC 5.2.1).
 */
import { PARAGRAPH_ORDER } from "./taxonomy.mjs";

// ---------------------------------------------------------------------------
// The violation arc (BUILD-SPEC 4.2). Lines under "violation arc:" of the form
// "  Name: <dimension text> -- clean on <list>".
// ---------------------------------------------------------------------------

export function parseViolationArc(frontmatter) {
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

export function parseEmployees(body, arc) {
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

export function parseFlavorSections(block, employeeName) {
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
