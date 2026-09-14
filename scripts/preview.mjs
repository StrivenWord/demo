#!/usr/bin/env node
/**
 * Open the built site the way a colleague will: as a local file, no server.
 *
 * This is the only faithful test of the primary requirement. `npm run dev` serves
 * over HTTP, which resolves paths that file:// cannot, so a site that works on
 * localhost can still be broken offline. See docs/BUILD-SPEC.md section 0.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const entry = resolve("site/index.html");

if (!existsSync(entry)) {
  console.error("No site/index.html. Run `npm run build` first.");
  process.exit(1);
}

const url = pathToFileURL(entry).href;
const opener =
  process.platform === "darwin" ? "open"
  : process.platform === "win32" ? "explorer"
  : "xdg-open";

console.log(`Opening ${url}`);
console.log("This is the offline view. If anything is broken here but works under");
console.log("`npm run dev`, it is a portability bug. Run `npm run check`.");

spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
