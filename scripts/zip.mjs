#!/usr/bin/env node
/**
 * Package site/ as the distributable offline archive.
 *
 * The recipient unzips it and double-clicks index.html. No server, no install,
 * no network. See docs/BUILD-SPEC.md section 10.
 */

import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const out = `county-ai-roles-v${version}.zip`;

if (!existsSync("site")) {
  console.error("No site/ directory. Run `npm run all` first.");
  process.exit(1);
}

if (existsSync(out)) rmSync(out);

// Zip from inside site/ so the archive expands to loose files rather than a
// nested site/ directory the recipient has to dig through.
const result = spawnSync("zip", ["-r", "-q", `../${out}`, "."], {
  cwd: "site",
  stdio: "inherit"
});

if (result.error || result.status !== 0) {
  console.error("\n`zip` failed or is not installed.");
  console.error("Fallback: compress the site/ folder with any archive tool.");
  process.exit(1);
}

console.log(`Wrote ${out}`);
console.log("Recipient: unzip, then open index.html. No web server required.");
