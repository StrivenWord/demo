/**
 * Parse src/sources/operational-dimension-definitions.md into data.json's `dimensions`
 * array. See docs/BUILD-SPEC.md section 4.3.
 *
 * Unlike the policy texts, this file stays a vendored upstream input: it is the county's
 * generation standard, with its own provenance chain, and this repo does not own it. Moved
 * here unchanged from scripts/extract.mjs so that both the old extractor and the new
 * lexia-based builder can share it.
 *
 * BUILD-SPEC 4.3: this file uses real em dashes, unlike the policy texts file. Do not
 * normalize either one; render what is there.
 */
import { DIMENSION_IDS } from "./taxonomy.mjs";
import { splitFrontmatter } from "./frontmatter.mjs";

export function parseDimensions(text) {
  const { body } = splitFrontmatter(text);

  // Split into "## Heading" sections; each section's content runs until the next
  // "## " heading (or end of file).
  const sectionRe = /^## (.+)$/gm;
  const matches = [...body.matchAll(sectionRe)];
  const sections = {};
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    sections[name] = body.slice(start, end);
  }

  const dimensions = [];

  for (const id of DIMENSION_IDS) {
    const name = id[0].toUpperCase() + id.slice(1);
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
      id,
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
