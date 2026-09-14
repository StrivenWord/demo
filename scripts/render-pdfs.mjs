#!/usr/bin/env node
/**
 * Render the 21 PDFs from the built print pages, using Playwright over
 * file://. See docs/BUILD-SPEC.md section 8 and TOOLING-AND-DEPLOYMENT.md
 * section 6.3.
 *
 * Runs after `eleventy` (npm run build), over site/print/. Loading via
 * file:// rather than a dev server is deliberate: it exercises the same
 * code path a colleague's browser will use, so a stray absolute path or
 * fetch() call fails this step in CI before it ever ships.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, statSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

if (!existsSync("data.json")) {
  console.error("No data.json. Run `npm run extract` first.");
  process.exit(1);
}
if (!existsSync("site/index.html")) {
  console.error("No site/index.html. Run `npm run build` first.");
  process.exit(1);
}

const data = JSON.parse(readFileSync("data.json", "utf8"));
const employeeIds = data.employees.map((e) => e.id);
const flavorIds = data.flavors.map((f) => f.id);

const jobs = [];
for (const jobId of employeeIds) {
  for (const flavorId of flavorIds) {
    jobs.push({ name: `${jobId}-${flavorId}`, printDir: `${jobId}-${flavorId}` });
  }
}
for (const jobId of employeeIds) {
  jobs.push({ name: `${jobId}-packet`, printDir: jobId });
}
jobs.push({ name: "compendium", printDir: "compendium" });

mkdirSync("site/pdf", { recursive: true });

// Footer carries provenance and page numbers. This must come from Playwright,
// not CSS: headless Chromium does not implement CSS Paged Media margin boxes,
// so @bottom-center and counter(page) silently render nothing. footerTemplate
// needs an explicit font-size (its default is effectively zero, an invisible
// footer that looks like a bug) and margin.bottom must reserve room for it.
function footerTemplate() {
  return `<div style="font-size:8pt;width:100%;padding:0 0.75in;
    color:#475569;display:flex;justify-content:space-between;
    font-family:Arial,sans-serif;">
    <span>Herkimer County AI Roles &middot; ${data.meta.version} &middot; ${data.meta.generated}</span>
    <span><span class="pageNumber"></span>/<span class="totalPages"></span></span>
  </div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();

let failed = 0;
for (const job of jobs) {
  const src = resolve(`site/print/${job.printDir}/index.html`);
  if (!existsSync(src)) {
    console.error(`Missing print source for "${job.name}": ${src}`);
    failed++;
    continue;
  }
  await page.goto(pathToFileURL(src).href);
  await page.pdf({
    path: `site/pdf/${job.name}.pdf`,
    format: "Letter",
    printBackground: true,
    margin: { top: "0.6in", bottom: "0.6in", left: "0.75in", right: "0.75in" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: footerTemplate()
  });
  console.log(`Wrote site/pdf/${job.name}.pdf`);
}

await browser.close();

if (failed > 0) {
  console.error(`\n${failed} PDF(s) failed to render.`);
  process.exit(1);
}

patchDownloadSizes();

/**
 * Content pages render a PDF download link before the PDF exists
 * (BUILD-SPEC 6.1 order: eleventy runs before this script). Each link
 * carries a placeholder <span data-pdf-size-for="name">; fill it in now
 * that the file sizes are known (DESIGN-SYSTEM 6.5: "the file size in the
 * label").
 */
function patchDownloadSizes() {
  const files = walk("site").filter((f) => f.endsWith(".html"));
  let patched = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const next = text.replace(
      /<span class="pdf-size" data-pdf-size-for="([\w-]+)"><\/span>/g,
      (whole, name) => {
        const pdfPath = `site/pdf/${name}.pdf`;
        if (!existsSync(pdfPath)) return whole;
        const kb = Math.max(1, Math.round(statSync(pdfPath).size / 1024));
        return `<span class="pdf-size"> (${kb} KB)</span>`;
      }
    );
    if (next !== text) {
      writeFileSync(file, next);
      patched++;
    }
  }
  console.log(`Filled in PDF size labels on ${patched} page(s).`);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

console.log(`\n${jobs.length} PDFs written to site/pdf/.`);
