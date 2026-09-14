/**
 * Minimal frontmatter helpers for the vendored source documents.
 *
 * Deliberately not a YAML parser: the v5 policy file's `violation arc` block has a key
 * containing a space, which strict parsers object to (BUILD-SPEC 5.2.1). The lexia tree
 * introduced later uses well-formed frontmatter and is parsed with gray-matter instead;
 * these helpers exist only for the two frozen/vendored files.
 */

/** Split on the first two `---` lines. */
export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("No frontmatter block found.");
  return { frontmatter: m[1], body: m[2] };
}

/**
 * Read a single top-level scalar out of a frontmatter block, e.g. `date: 2026-06-10`.
 * Returns null when the key is absent. Indented lines are ignored so that keys nested
 * under `violation arc:` cannot be mistaken for top-level ones.
 */
export function frontmatterScalar(frontmatter, key) {
  const re = new RegExp(`^${key}:[ \\t]*(.+)$`, "m");
  const m = frontmatter.match(re);
  return m ? m[1].trim() : null;
}
