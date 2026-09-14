---
title: Build Specification
project: county-ai-roles
date: 2026-09-13
status: Ready to implement
audience: implementer
---

# Build Specification

This document is written to be followed literally. Every structure described here was
verified against the actual source files on 2026-09-13, not inferred from the design
spec. Where this document and `COUNTY_AI_ROLES_DESIGN_SPEC.md` disagree, **this
document is correct**; discrepancies are listed in section 12.

Companion documents:
- `COMMANDS.md` for the working command line; **phases 1 and 3 are already built**
- `DESIGN-SYSTEM.md` for colors, typography, components, accessibility
- `TOOLING-AND-DEPLOYMENT.md` for rationale, git practice, deployment

**Status:** the toolchain exists and works. `npm install`, `npm run dev`,
`npm run build`, `npm test`, and `npm run check` are verified. Section 2 below records
what was installed; read it for reference rather than executing it. Begin at phase 2.

## 0. The one hard requirement

**Produce a fully static site in `site/` that works with no web server.**

Everything else is negotiable. GitHub Pages is one deployment target the build
accommodates, not a requirement. The test of success is: zip `site/`, send it to
someone, they unzip it, double-click `index.html`, and the entire site works offline.

If a technique would break that, do not use it. Section 3 lists what breaks.

## 1. Build order

Follow these phases in order. Each has an acceptance check. Do not begin a phase until
the previous one's check passes.

| Phase | Produces | Check |
|---|---|---|
| ~~1~~ | ~~Repo scaffold~~ | **Done.** `npm run build` writes `site/index.html` |
| 2 | `data.json` | `npm run validate` exits 0; 4 employees x 4 flavors present |
| ~~3~~ | ~~Relative URL filter~~ | **Done.** `npm test` passes 9/9 |
| 4 | Layouts and CSS | Landing page opens from `file://` with styles applied |
| 5 | 26 content pages | All pages reachable by clicking, from `file://` |
| 6 | 21 print pages | Print preview shows no nav chrome |
| 7 | PDF script | 21 PDFs in `site/pdf/` |
| 8 | Client JS | Diff view works; site still works with JS disabled |
| 9 | Accessibility pass | `DESIGN-SYSTEM.md` section 8 checklist |

## 2. Phase 1: Scaffold

```bash
mkdir -p county-ai-roles && cd county-ai-roles
npm init -y
npm install --save-dev @11ty/eleventy@^3 playwright
mkdir -p src/{sources,_data,_includes,assets} scripts docs .github/workflows
```

### 2.1 `package.json`

Replace the generated file's `scripts` and add `"type": "module"`:

```json
{
  "name": "county-ai-roles",
  "version": "5.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "extract": "node scripts/extract.mjs",
    "validate": "node scripts/validate.mjs",
    "build": "eleventy",
    "pdfs": "node scripts/render-pdfs.mjs",
    "all": "npm run validate && npm run build && npm run pdfs",
    "serve": "eleventy --serve",
    "portable": "npm run all && cd site && zip -r ../county-ai-roles.zip ."
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.0.0",
    "playwright": "^1.48.0"
  }
}
```

### 2.2 `eleventy.config.js`

```js
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // See section 6.2. Do not modify without re-running the check there.
  eleventyConfig.addFilter("rel", function (target) {
    const dir = this.page.url.replace(/[^/]*$/, "");
    const depth = dir.split("/").filter(Boolean).length;
    const prefix = depth === 0 ? "./" : "../".repeat(depth);
    return prefix + String(target).replace(/^\//, "");
  });

  return {
    dir: { input: "src", output: "site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
}
```

### 2.3 `.gitignore`

```gitignore
node_modules/
site/
src/assets/data.js
*.zip
.cache/
.DS_Store
```

### 2.4 Vendor the sources

Copy both files into `src/sources/`, preserving content byte for byte:

```
src/sources/workshop-1-policy-texts-v5.md
src/sources/operational-dimension-definitions.md
```

Originals live in the private `herk` repo at
`meetings/20260610 - june 10 workshop/v5/` and `definitions/2026-06-03-...` respectively.

## 3. Constraints that cannot be violated

These follow from the `file://` requirement in section 0. Each one has caused a broken
build in similar projects.

| Do not | Because | Do this instead |
|---|---|---|
| `fetch()` or `XMLHttpRequest` | Blocked under `file://`, origin is `null` | Inline data via `<script src>` (6.3) |
| `<script type="module">` | Blocked under `file://` | Classic `<script>` only |
| Root-absolute paths (`/assets/x.css`) | Resolves to the filesystem root | The `rel` filter (6.2) |
| Directory links (`href="../lux/"`) | No index resolution under `file://` | `href="../lux/index.html"` |
| External SVG (`<use href="s.svg#i">`) | Blocked under `file://` | Inline the SVG markup |
| `history.pushState` | No effect under `file://` | `location.hash` |
| Web fonts | Unreliable under `file://` | System stack (DESIGN-SYSTEM 5.1) |
| Service workers, `localStorage` | Unavailable or inconsistent | Do not use |
| Any CDN or external URL | Fails offline | Vendor everything |

## 4. Source document structure (verified)

### 4.1 `workshop-1-policy-texts-v5.md`

YAML frontmatter, then a `# Workshop 1 Policy Texts` heading, an intro line, then four
employee blocks separated by `---` on its own line.

**Employee block:**

```
## Employee <N>: <Name>, <Role>

**The scenario.** <scenario text, one paragraph>

**The violation question:** Did <Name> violate the policy?

---

### Employee <N> / <Color>: <Label>
<Dimension config line>

<paragraph 1>

<paragraph 2>

<paragraph 3>

<paragraph 4>

---
```

**Verified invariants.** All were checked against all 16 blocks:

1. Exactly 4 employees: `Lux` (1), `Puk` (2), `Jam` (3), `Wow` (4).
2. Exactly 4 flavors per employee, always in order: `Green`, `Red`, `Blue`, `Yellow`.
3. Flavor labels are always `Guardrails`, `Enable`, `Light-touch`, `Exposed`.
4. The dimension config line is the line immediately after each `###` header, format:
   `Security <Hi|Lo> | Accountability <Hi|Lo> | Efficiency <Hi|Lo> | Innovation <Hi|Lo>`
   Note this order: **Security, Accountability, Efficiency, Innovation.**
5. Exactly **4 body paragraphs** follow the config line, blank-line separated, always
   in this order: **Security, Efficiency, Innovation, Accountability.**
   This is a different order from the config line. Do not confuse them.
6. The dimension configuration is **identical across all four employees** for a given
   flavor. There are four policy flavors, not sixteen combinations:

   | Flavor | Label | Security | Accountability | Efficiency | Innovation |
   |---|---|---|---|---|---|
   | Green | Guardrails | Hi | Hi | Lo | Lo |
   | Red | Enable | Hi | Hi | Hi | Hi |
   | Blue | Light-touch | Hi | Lo | Hi | Hi |
   | Yellow | Exposed | Lo | Lo | Hi | Hi |

7. Employee roles as written: `DSS Caseworker`, `Sheriff's Deputy`,
   `Public Health Nurse`, `Administration Staffer`.
8. The source uses ` -- ` (space, two hyphens, space) rather than em dashes. Preserve
   it exactly; do not normalize.

### 4.2 The violation arc (important, and absent from the design spec)

The frontmatter contains a `violation arc` map recording which flavors each employee's
scenario is **compliant** under. This is the pedagogical core of the exercise and must
appear on the site.

```yaml
violation arc:
  Zip: Security (wrong tool) -- clean on Yellow
  Lux: Security (data left county systems) -- clean on Yellow
  Puk: Efficiency (acted without confirmation) -- clean on Red/Blue/Yellow
  Jam: Accountability (no log) -- clean on Blue/Yellow
  Wow: all four dimensions, one per flavor -- clean on Yellow only
```

Parsed to a per-employee verdict across all 16 combinations:

| Employee | Dimension violated | Green | Red | Blue | Yellow |
|---|---|---|---|---|---|
| Lux | Security | Violation | Violation | Violation | Compliant |
| Puk | Efficiency | Violation | Compliant | Compliant | Compliant |
| Jam | Accountability | Violation | Violation | Compliant | Compliant |
| Wow | all four | Violation | Violation | Violation | Compliant |

**`Zip` has no employee block in the document.** It is a leftover from an earlier
version. Section 12 records this; the validator must flag it rather than fail on it.

### 4.3 `operational-dimension-definitions.md`

YAML frontmatter (note: blank lines between keys, still valid YAML), then narrative
sections, then one `##` section per dimension in order: `Security`, `Accountability`,
`Efficiency`, `Innovation`. Each dimension section contains:

```
## <Name>

County-calibrated definition. <text> The operative question is: <question>?

Hi: <text>

Lo: <text>

Where this language was built. <provenance text>

External alignment. <citation text>
```

Extract: the operative question (the sentence after `The operative question is:`,
through the `?`), the `Hi:` text, and the `Lo:` text. The provenance and alignment
paragraphs are optional for the site; capture them but do not display them by default.

**This file uses real em dashes (`—`)**, unlike the policy texts file. Do not
normalize either file; render what is there.

## 5. Phase 2: `data.json`

### 5.1 Schema

Write `scripts/extract.mjs` to emit `data.json` at the repo root with exactly this
shape. No additional top-level keys.

```json
{
  "meta": {
    "version": "v5",
    "sourceFile": "workshop-1-policy-texts-v5.md",
    "definitionsFile": "operational-dimension-definitions.md",
    "generated": "2026-09-13"
  },
  "dimensions": [
    {
      "id": "security",
      "name": "Security",
      "operativeQuestion": "where does the data go, and who approved the tool?",
      "hi": "approved, security-vetted tools only; resident and employee data shall not leave county networks; all tools are auditable by IT.",
      "lo": "any commercially available tool is permitted; staff are responsible for appropriate data handling.",
      "provenance": "...",
      "alignment": "..."
    }
  ],
  "flavors": [
    {
      "id": "green",
      "name": "Green",
      "label": "Guardrails",
      "character": "Most restrictive; maximum oversight",
      "dimensions": { "security": "Hi", "accountability": "Hi", "efficiency": "Lo", "innovation": "Lo" }
    }
  ],
  "employees": [
    {
      "id": "lux",
      "number": 1,
      "name": "Lux",
      "role": "DSS Caseworker",
      "scenario": "Lux is a caseworker at ...",
      "violationQuestion": "Did Lux violate the policy?",
      "violatedDimension": "security",
      "compliantUnder": ["yellow"],
      "policies": {
        "green": {
          "paragraphs": [
            { "dimension": "security",       "text": "..." },
            { "dimension": "efficiency",     "text": "..." },
            { "dimension": "innovation",     "text": "..." },
            { "dimension": "accountability", "text": "..." }
          ]
        }
      }
    }
  ]
}
```

`character` strings for flavors (these are authored, not extracted):

- green: `Most restrictive; maximum oversight`
- red: `Fast and safe; strong logging, open tool adoption`
- blue: `Fast with minimal logging; data stays in county systems`
- yellow: `Least constrained; highest exposure`

Employee ids are the lowercased name: `lux`, `puk`, `jam`, `wow`.

### 5.2 Parsing rules

1. Split frontmatter on the first two `---` lines. Parse `violation arc` by hand; it is
   not strict YAML-friendly given the key contains a space. A line-by-line regex over
   the block is sufficient and preferable to adding a YAML dependency.
2. Split the body on lines matching `^## Employee (\d+): (.+?), (.+)$`.
3. Within an employee block, scenario is the text after `**The scenario.** ` up to the
   next blank line. Violation question is the text after `**The violation question:** `.
4. Split on `^### Employee \d+ / (\w+): (.+)$` for flavors.
5. The line immediately following a flavor header is the config line. Parse with
   `/(\w+) (Hi|Lo)/g` and map names to lowercase ids.
6. Remaining content up to the next `---` or `###`, split on blank lines, is the four
   paragraphs. Assign dimensions positionally:
   `["security", "efficiency", "innovation", "accountability"]`.
7. Trim whitespace. Preserve all internal punctuation exactly, including ` -- `.

### 5.3 `scripts/validate.mjs`

Exit non-zero with a clear message on any failure:

1. Exactly 4 employees, ids `lux`, `puk`, `jam`, `wow`.
2. Each employee has exactly 4 flavors: `green`, `red`, `blue`, `yellow`.
3. Each flavor has exactly 4 paragraphs, dimensions in the order given in 5.2.6.
4. Each paragraph text is non-empty and longer than 40 characters.
5. All four employees share identical dimension configs per flavor, matching the table
   in 4.1.6 exactly.
6. Exactly 4 dimensions, each with non-empty `hi`, `lo`, and an `operativeQuestion`
   ending in `?`.
7. Every `Accountability Hi` paragraph (Green and Red only) contains the substring
   `not the AI tool`. This was a known v5 fix; regression here is silent and serious.
8. **Warn, do not fail**, if the violation arc names an employee with no block. This
   catches the orphaned `Zip` entry without blocking the build.

Print a summary: `16 policies, 4 dimensions, 0 errors, 1 warning`.

## 6. Phase 3: Core mechanics

### 6.1 Page inventory

26 content pages plus 21 print pages. Output paths are exact.

| Page | Output path | Count |
|---|---|---|
| Overview | `site/index.html` | 1 |
| Job x flavor | `site/jobs/<job>/<flavor>/index.html` | 16 |
| Job compare | `site/jobs/<job>/index.html` | 4 |
| Policy matrix | `site/policies/index.html` | 1 |
| Policy detail | `site/policies/<flavor>/index.html` | 4 |
| Print, single | `site/print/<job>-<flavor>/index.html` | 16 |
| Print, packet | `site/print/<job>/index.html` | 4 |
| Print, compendium | `site/print/compendium/index.html` | 1 |

`<job>` is `lux|puk|jam|wow`. `<flavor>` is `green|red|blue|yellow`.

Generate the 16 with Eleventy pagination over a computed cross product. Create
`src/_data/combos.js`:

```js
import data from "../../data.json" with { type: "json" };

export default () =>
  data.employees.flatMap((e) =>
    data.flavors.map((f) => ({
      jobId: e.id, flavorId: f.id, employee: e, flavor: f
    }))
  );
```

Then in `src/jobs/job-flavor.njk`:

```njk
---
pagination: { data: combos, size: 1, alias: combo }
permalink: "jobs/{{ combo.jobId }}/{{ combo.flavorId }}/index.html"
layout: base.njk
---
```

### 6.2 The `rel` filter

Every internal URL passes through this filter. It is the single mechanism keeping the
build `file://` safe, and it is the most likely thing to be implemented incorrectly.

Pass **root-relative** targets (`/assets/styles.css`, `/jobs/lux/index.html`). The
filter returns a path relative to the current page.

**Acceptance check.** Given the implementation in 2.2, these must hold:

| Current `page.url` | `rel("/assets/styles.css")` |
|---|---|
| `/index.html` | `./assets/styles.css` |
| `/jobs/lux/index.html` | `../../assets/styles.css` |
| `/jobs/lux/green/index.html` | `../../../assets/styles.css` |
| `/policies/green/index.html` | `../../assets/styles.css` |

Note the filter strips the trailing filename before counting depth, which is why it
works whether or not a permalink ends in `index.html`. Use `function`, not an arrow
function, or `this.page` is undefined.

Usage: `<link rel="stylesheet" href="{{ '/assets/styles.css' | rel }}">`

**Never** write a raw `href` to an internal page. Every one goes through `rel`.

### 6.3 Data delivery to the browser

The client JS needs the policy data for the diff view. It cannot `fetch` it.

Add a build step to `extract.mjs` that also writes `src/assets/data.js`:

```js
window.COUNTY_AI_DATA = { /* the same object as data.json */ };
```

Load it with `<script src="{{ '/assets/data.js' | rel }}"></script>` before
`scripts.js`. `src/assets/data.js` is gitignored; it is generated.

## 7. Phases 4 to 6: Templates

### 7.1 `src/_includes/base.njk`

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>{{ title }} | Herkimer County AI Roles</title>
<link rel="stylesheet" href="{{ '/assets/styles.css' | rel }}">
</head>
<body>
  {% include "nav.njk" %}
  <main id="main">{{ content | safe }}</main>
  {% include "footer.njk" %}
</body>
</html>
```

The `noindex` tag is required on every page. See TOOLING-AND-DEPLOYMENT.md section 5.4.

### 7.2 Navigation

Three rows, per DESIGN-SYSTEM.md section 4.1. **Tabs are links, not ARIA tabs.** Do not
use `role="tab"`, `role="tablist"`, or `role="tabpanel"` anywhere in this project.

```html
<nav aria-label="Section">
  <ul>
    <li><a href="{{ '/index.html' | rel }}">Overview</a></li>
    <li><a href="{{ '/jobs/lux/green/index.html' | rel }}" aria-current="page">Jobs</a></li>
    <li><a href="{{ '/policies/index.html' | rel }}">Policies</a></li>
  </ul>
</nav>
```

Each of the three `<nav>` elements needs a distinct `aria-label`: `Section`, `Job`,
`Policy flavor`. Mark the active item with `aria-current="page"` and style on that
attribute, not on a class.

### 7.3 Job x flavor page content

In order:

1. `<h1>` with the employee name and role
2. Scenario block, then the violation question
3. **Verdict callout**: whether this scenario is compliant under this flavor, from
   `compliantUnder` (4.2). This is the payoff of the whole exercise; do not omit it.
   Compliant and violation states must differ by more than color.
4. Flavor dimension chips, per DESIGN-SYSTEM.md section 2.3
5. The four policy paragraphs, each under a heading naming its dimension
6. Risk callout if one applies (7.5)
7. PDF download link, `rel="nofollow"`

### 7.4 Print pages

Same content, no navigation, no download link. Use a separate `print.njk` layout that
omits `nav.njk` and `footer.njk`. The print stylesheet handles the rest. Packet pages
concatenate all four flavors with `break-before: page` between them.

### 7.5 Risk callouts

Authored, not extracted. Exactly two, both verified against the source text:

| Employee | Flavor | Title | Description |
|---|---|---|---|
| puk | yellow | Federal compliance exposure | Security Lo removes the CJIS compliance requirement present in Green, Red, and Blue. Criminal justice data may be processed outside county or state-authorized systems on personally owned devices. |
| wow | blue | Legal documentation gap | Accountability Lo removes AI-use logging from the determination record. The Green and Red texts retain the log as part of that record; Blue does not. |

Store these in `src/_data/riskCallouts.js`. Match on employee id plus flavor id.

## 8. Phase 7: PDFs

`scripts/render-pdfs.mjs`, using Playwright. Runs **after** `eleventy`, over the built
output in `site/`.

```js
await page.goto("file://" + absolutePathTo("site/print/lux-green/index.html"));
await page.pdf({
  path: "site/pdf/lux-green.pdf",
  format: "Letter",
  printBackground: true,
  margin: { top: "0.6in", bottom: "0.6in", left: "0.75in", right: "0.75in" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font-size:8pt;width:100%;padding:0 0.75in;
    color:#475569;display:flex;justify-content:space-between;">
    <span>Herkimer County AI Roles &middot; v5 &middot; 2026-09-13</span>
    <span class="pageNumber"></span>/<span class="totalPages"></span></div>`
});
```

Five things that will otherwise cost an afternoon:

1. Load via `file://`, not a dev server. This makes CI fail if anyone introduces an
   absolute path, so the portability rule enforces itself.
2. `footerTemplate` **must** carry an explicit `font-size`. Its default is effectively
   zero and renders an invisible footer that looks like a bug.
3. `margin.bottom` must reserve space or the footer overlaps body text.
4. `displayHeaderFooter: true` is required, and `headerTemplate` must be a non-empty
   string even when empty-looking; use `<span></span>`.
5. Headless Chromium ignores CSS Paged Media margin boxes. `@bottom-center` and
   `counter(page)` silently do nothing. Page numbers come only from the template above.

Output names: `<job>-<flavor>.pdf` (16), `<job>-packet.pdf` (4), `compendium.pdf` (1).

## 9. Phase 8: Client JavaScript

Scope is deliberately small. Everything else is pre-rendered.

**The only required behavior**: on `jobs/<job>/index.html`, a control that selects two
flavors and collapses the four-column layout to those two, highlighting differing
paragraphs.

Rules:

- Classic script, no modules, no bundler, no dependencies.
- The page must be complete and readable with JS disabled. Without JS, it shows all
  four flavors side by side. JS only narrows that view.
- State in `location.hash` as `#diff=green,red`. Read it on load; write it on change.
- Never `fetch`. Read `window.COUNTY_AI_DATA`.
- Paragraph comparison is positional: paragraph `i` of flavor A against paragraph `i`
  of flavor B. The four-paragraph invariant in 4.1.5 guarantees alignment.
- Mark changes with a left border and a visually hidden `changed:` prefix, not color
  alone.

## 10. Deployment

The build output is a plain folder. It has no server requirements, no absolute paths,
and no build-time host configuration. Every target below consumes the same `site/`.

| Target | How |
|---|---|
| **Zip for colleagues** | `npm run portable`; send `county-ai-roles.zip` |
| **GitHub Pages** | Actions workflow in TOOLING-AND-DEPLOYMENT.md section 5.2 |
| **Netlify, Cloudflare Pages** | Build command `npm run all`, publish directory `site` |
| **Any web server** | Copy `site/` to the document root |
| **County intranet, file share** | Copy the folder; open `index.html` |

GitHub Pages is a contingency the build accommodates, not a dependency. If it is used,
note that a project site at `org.github.io/county-ai-roles/` cannot exclude PDFs from
search indexing; see TOOLING-AND-DEPLOYMENT.md section 5.4.3.

## 11. Acceptance criteria

The build is complete when all of these pass.

**Content**
- [ ] 16 policy texts render word for word identical to `src/sources/`, including ` -- `
- [ ] All 4 dimension definitions render with operative questions
- [ ] Every job x flavor page shows the compliance verdict from 4.2
- [ ] Both risk callouts from 7.5 appear on the correct pages, and nowhere else

**Portability, the primary requirement**
- [ ] `site/` opened via `file://` works fully: every link, every page, the diff view
- [ ] Zero occurrences of `href="/` or `src="/` in the built output
- [ ] Zero occurrences of `fetch(` or `type="module"` in the built output
- [ ] Moving `site/` to a different directory breaks nothing

**Build**
- [ ] `npm run all` succeeds from a clean checkout in under 2 minutes
- [ ] `npm run validate` exits 0 with the orphaned-`Zip` warning shown
- [ ] 21 PDFs in `site/pdf/`, each with a readable provenance footer and page numbers
- [ ] `site/` is gitignored and absent from `git status`

**Accessibility** (DESIGN-SYSTEM.md section 8)
- [ ] Site fully usable with JavaScript disabled
- [ ] No `role="tab"` anywhere; tabs are links with `aria-current="page"`
- [ ] No information conveyed by color alone
- [ ] Usable at 320px width and 200% zoom without horizontal scroll

## 12. Known discrepancies with the design spec

Verified against the sources. The design spec is wrong on these points.

1. **Employee 4's role.** The spec says `County Attorney Staffer`. The source says
   `Administration Staffer`; the scenario places her in the County Attorney's office.
   Use the source.
2. **`Zip` is orphaned.** The frontmatter violation arc names five employees; only four
   have blocks. Warn, do not fail. Worth raising with the document owner.
3. **The violation arc is undocumented in the spec** but is the pedagogical core of the
   material. It must appear on the site. See 4.2.
4. **Flavors are not a full 4x4 matrix.** All four employees share one dimension config
   per flavor. There are 4 policy configurations, not 16. The spec's language about
   combinations is misleading.
5. **The spec's `diffTemplates` structure is unnecessary.** The verified four-paragraph
   invariant (4.1.5) makes positional comparison sufficient. Do not build the section
   extraction the spec describes.
6. **Flavor hex values changed** for contrast compliance. Use DESIGN-SYSTEM.md section
   2.2, not the spec's section 4.1.
7. **The spec's dimension color system is dropped.** See DESIGN-SYSTEM.md section 2.3.
