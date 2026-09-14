/**
 * Eleventy configuration for county-ai-roles.
 *
 * The governing constraint for this whole project is that `site/` must work when
 * opened directly from a filesystem with no web server. See docs/BUILD-SPEC.md
 * section 0. Several settings below exist only to protect that property; each is
 * marked PORTABILITY. Do not change those without reading the referenced section.
 */

import { rel } from "./scripts/lib/rel.mjs";

export default function (eleventyConfig) {
  // ---------------------------------------------------------------------------
  // Assets
  // ---------------------------------------------------------------------------

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // The vendored markdown in src/sources/ is a data input for scripts/extract.mjs,
  // not page content. Without this, Eleventy's default markdown template format
  // renders it as two stray pages under site/sources/.
  eleventyConfig.ignores.add("src/sources/**");

  // PORTABILITY (BUILD-SPEC 6.2). Copy rather than serve-from-source during `dev`,
  // so what the dev server serves is byte-identical to what `build` writes. In
  // passthrough mode the server would resolve asset URLs differently from disk and
  // could hide a broken relative path until deploy time.
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  // ---------------------------------------------------------------------------
  // The `rel` filter: the mechanism that keeps every URL relative.
  // ---------------------------------------------------------------------------

  /**
   * Convert a root-relative target into a path relative to the current page.
   *
   * PORTABILITY (BUILD-SPEC 6.2). Every internal href and src in this project must
   * pass through this filter. A root-absolute path like /assets/styles.css resolves
   * to the filesystem root under file:// and breaks the offline build.
   *
   *   {{ '/assets/styles.css' | rel }}
   *
   * Implementation lives in scripts/lib/rel.mjs so it can be unit tested without
   * booting Eleventy; run `npm test`. Must be a `function`, not an arrow function,
   * or `this.page` is undefined.
   */
  eleventyConfig.addFilter("rel", function (target) {
    return rel(this.page.url, target);
  });

  // ---------------------------------------------------------------------------
  // Watch targets
  // ---------------------------------------------------------------------------

  // data.json lives at the repo root, outside the Eleventy input directory, so it
  // is not watched automatically. Without this, `npm run dev` would not rebuild
  // after `npm run extract`.
  eleventyConfig.addWatchTarget("./data.json");

  // ---------------------------------------------------------------------------
  // Dev server
  // ---------------------------------------------------------------------------

  eleventyConfig.setServerOptions({
    port: 8080,

    // Full page reload rather than DOM diffing. Client state lives in
    // location.hash (BUILD-SPEC 9) and a partial DOM patch can leave the page and
    // the hash disagreeing, which looks like a bug in the diff view.
    domDiff: false,

    showAllHosts: false
  });

  // ---------------------------------------------------------------------------

  return {
    dir: {
      input: "src",
      output: "site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: false
  };
}
