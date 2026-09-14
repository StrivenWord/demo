/**
 * Relative-URL resolution: the single mechanism keeping the build file:// safe.
 *
 * Lives in its own module so it can be unit tested (scripts/test-rel.mjs) without
 * booting Eleventy. See docs/BUILD-SPEC.md section 6.2.
 *
 * @param {string} pageUrl  Eleventy's `page.url` for the current page.
 * @param {string} target   A root-relative target, e.g. "/assets/styles.css".
 * @returns {string}        Path relative to the current page.
 */
export function rel(pageUrl, target) {
  const dir = pageUrl.replace(/[^/]*$/, "");
  const depth = dir.split("/").filter(Boolean).length;
  const prefix = depth === 0 ? "./" : "../".repeat(depth);
  return prefix + String(target).replace(/^\//, "");
}
