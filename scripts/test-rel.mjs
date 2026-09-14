#!/usr/bin/env node
/**
 * Acceptance table for the `rel` filter, docs/BUILD-SPEC.md section 6.2.
 *
 * This filter is the most likely thing in the project to be subtly wrong, and a
 * wrong result does not fail the build: it produces a site that works on localhost
 * and breaks when opened from a filesystem. Hence a dedicated test.
 */
import { rel } from "./lib/rel.mjs";

const CASES = [
  ["/index.html",                  "/assets/styles.css", "./assets/styles.css"],
  ["/jobs/lux/index.html",         "/assets/styles.css", "../../assets/styles.css"],
  ["/jobs/lux/green/index.html",   "/assets/styles.css", "../../../assets/styles.css"],
  ["/policies/green/index.html",   "/assets/styles.css", "../../assets/styles.css"],
  ["/print/lux-green/index.html",  "/assets/styles.css", "../../assets/styles.css"],
  // Trailing-slash permalinks must behave identically.
  ["/jobs/lux/",                   "/assets/styles.css", "../../assets/styles.css"],
  ["/",                            "/assets/styles.css", "./assets/styles.css"],
  // Cross-page links.
  ["/jobs/lux/green/index.html",   "/index.html",        "../../../index.html"],
  ["/jobs/lux/green/index.html",   "/pdf/lux-green.pdf", "../../../pdf/lux-green.pdf"],
];

let failed = 0;
for (const [pageUrl, target, expected] of CASES) {
  const actual = rel(pageUrl, target);
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${pageUrl.padEnd(30)} ${target.padEnd(21)} -> ${actual}` +
    (ok ? "" : `\n      expected: ${expected}`)
  );
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed.`);
process.exit(failed > 0 ? 1 : 0);
