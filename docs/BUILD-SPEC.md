---
title: Build Specification
project: county-ai-roles
date: 2026-09-14
status: Built. Amended for the lexia authoring workflow.
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

**Status: built.** All nine phases are complete and verified. Section 2 records what was
installed; read it for reference rather than executing it.

**Amended 2026-09-14.** The policy text no longer lives in a single vendored document
parsed by `scripts/extract.mjs`. It lives in `content/`, one paragraph per file, and is
authored in this repository. Sections 2.4, 4, 5 and 6.1 carry the change; section 4.4 is
the new authoring format. `data.json` kept its exact shape through the migration, so no
template changed and no rendered page moved.

## 0. The one hard requirement

**Produce a fully static site in `site/` that works with no web server.**

Everything else is negotiable. GitHub Pages is one deployment target the build
accommodates, not a requirement. The test of success is: zip `site/`, send it to
someone, they unzip it, double-click `index.html`, and the entire site works offline.

If a technique would break that, do not use it. Section 3 lists what breaks.

## 1. Build order

Follow these phases in order. Each has an acceptance check. Do not begin a phase until
the previous one's check passes.

All phases are complete. Retained as the record of the order they were built in, and of
each one's acceptance check.

| Phase | Produces | Check |
|---|---|---|
| ~~1~~ | ~~Repo scaffold~~ | **Done.** `npm run build` writes `site/index.html` |
| ~~2~~ | ~~`data.json`~~ | **Done.** `npm run validate` exits 0 |
| ~~3~~ | ~~Relative URL filter~~ | **Done.** `npm test` passes 9/9 |
| ~~4~~ | ~~Layouts and CSS~~ | **Done.** |
| ~~5~~ | ~~26 content pages~~ | **Done.** |
| ~~6~~ | ~~21 print pages~~ | **Done.** |
| ~~7~~ | ~~PDF script~~ | **Done.** 21 PDFs in `site/pdf/` |
| ~~8~~ | ~~Client JS~~ | **Done.** |
| ~~9~~ | ~~Accessibility pass~~ | **Done.** |
| ~~10~~ | ~~`content/` authoring tree, 102 review pages~~ | **Done.** Section 4.4 |

## 2. Phase 1: Scaffold

```bash
mkdir -p county-ai-roles && cd county-ai-roles
npm init -y
npm install --save-dev @11ty/eleventy@^3 playwright
mkdir -p src/{sources,_data,_includes,assets} scripts docs .github/workflows
```

### 2.1 `package.json`

Replace the generated file's `scripts` and add `"type": "module"`. The review and
provenance commands (`lint:lexias`, `drift`, `workshop-doc`, `scaffold`, `migrate`)
came later; see COMMANDS.md section 1 for the full current set.

Note `build` and `validate` both run `build-data.mjs` first. That is what lets the
three CI workflows keep working unchanged: they call `validate && build && pdfs && check`
and get a fresh `data.json` without naming the step.

```json
{
  "name": "county-ai-roles",
  "version": "5.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "build:data": "node scripts/build-data.mjs",
    "validate": "node scripts/build-data.mjs && node scripts/validate.mjs",
    "build": "node scripts/build-data.mjs && eleventy",
    "dev": "eleventy --serve --incremental",
    "pdfs": "node scripts/render-pdfs.mjs",
    "check": "node scripts/check-portable.mjs",
    "all": "npm run build && npm run pdfs && npm run check",
    "portable": "npm run all && node scripts/zip.mjs"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.0.0",
    "gray-matter": "^4.0.3",
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
dist/          # npm run workshop-doc output
```

Note what is **not** ignored: `content/`, `data.json` and `review.json` are all
committed. See TOOLING-AND-DEPLOYMENT 3.

### 2.4 The two files in `src/sources/`

```
src/sources/workshop-1-policy-texts-v5.md          FROZEN. provenance only.
src/sources/operational-dimension-definitions.md   live vendored input.
```

Both were copied byte for byte from the private `herk` repo, at
`meetings/20260610 - june 10 workshop/v5/` and `definitions/2026-06-03-...`
respectively. They are no longer the same kind of artifact as each other.

**`workshop-1-policy-texts-v5.md` is frozen.** It is the record of what the June 10
workshop produced, and nothing more. The policy text it contains now lives in
`content/lexias/` (section 4.4), which is what the build reads. Three things still parse
the frozen file, all deliberately:

- `scripts/migrate-lexias.mjs`, once, to produce the lexia tree
- `scripts/drift.mjs`, to report how far the lexias have moved from it
- the orphaned-name check in `scripts/validate.mjs` (5.3.8, the `Zip` warning)

Do not edit it. Editing it would not change the site, and would destroy the baseline
`npm run drift` measures against.

**`operational-dimension-definitions.md` is still a live vendored input**, parsed on
every build. It is the county's generation standard, owned upstream; this repo does not
own it and should not edit it in place. Update it by copying a newer version in from a
`herk` checkout.

Note that `docs/TOOLING-AND-DEPLOYMENT.md` has referred to a `npm run sync` /
`scripts/sync-sources.mjs` for this. No such script has ever existed; the copy is manual.

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

Sections 4.1 to 4.3 describe the **frozen** v5 document. It is no longer the authoring
format -- see 4.4 for that -- but this remains an accurate description of it, and the
structure still matters: it is what `scripts/migrate-lexias.mjs` consumed to build the
lexia tree, what `scripts/drift.mjs` compares against, and what
`scripts/render-workshop-doc.mjs` reproduces.

### 4.1 `workshop-1-policy-texts-v5.md` (frozen)

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
   Both orders are now constants in `scripts/lib/taxonomy.mjs` (`CONFIG_LINE_ORDER` and
   `PARAGRAPH_ORDER`), and the trap survives the migration: `PARAGRAPH_ORDER` is still
   the emission order for `data.json` and is read positionally by
   `src/assets/scripts.js`. Sorting lexia filenames alphabetically would put
   `accountability` first and silently reorder every policy page. Check 5.3.3 guards it.
6. The dimension configuration is **identical across all four employees** for a given
   flavor. There are four policy flavors, not sixteen combinations:

   | Posture | Colour (June 2026) | Security | Accountability | Efficiency | Innovation |
   |---|---|---|---|---|---|
   | Guardrails | Green | Hi | Hi | Lo | Lo |
   | Enable | Red | Hi | Hi | Hi | Hi |
   | Light-touch | Blue | Hi | Lo | Hi | Hi |
   | Exposed | Yellow | Lo | Lo | Hi | Hi |

   **The posture is the stable identity; the colour is a label that has moved.** Upstream
   reassigned the colours on 2026-07-08 to a restriction-to-autonomy gradient, leaving
   postures and coordinates unchanged. This table records the June convention the frozen
   document uses. `content/flavors.json` holds the convention the site currently renders,
   and is the only place the mapping is written down. `scripts/validate.mjs` pins the
   coordinates by **posture** so that a relabelling cannot quietly redefine what
   Guardrails means.

7. Employee roles as written: `DSS Caseworker`, `Sheriff's Deputy`,
   `Public Health Nurse`, `Administration Staffer`.
8. The source uses ` -- ` (space, two hyphens, space) rather than em dashes. Preserve
   it exactly; do not normalize.
   **Now enforced, not merely stated.** Check 5.3.15 rejects an em dash, en dash or
   curly quote in any lexia body. This was prose guidance while the text sat in one
   vendored file nobody edited; with 64 files edited by hand in editors that autocorrect,
   it needed teeth.

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
It has no file in `content/employees/` either, so the warning is now the only thing
carrying the fact that Zip ever existed. Keep it.

**Where the arc lives now.** It is no longer parsed from frontmatter. Each employee file
carries its own `violatedDimension` and `compliantUnder` (section 4.4), and
`scripts/render-workshop-doc.mjs` reassembles the block above from them when it
regenerates the document.

`compliantUnder` is written in colour names and drives the Compliant/Violation banner on
all 16 job pages, all 21 PDFs and the overview grid. A colour reassignment that remaps
the flavors without remapping it inverts every verdict on the site, teaching the exact
opposite lesson, while nothing looks broken. Check 5.3.16 pins these verdicts **by
posture** precisely so that mistake cannot be silent.

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

### 4.4 `content/` -- the authoring format

This is what the build reads. One paragraph per file.

```
content/
  meta.json                  version and date of the material
  flavors.json               the flavor / posture / Hi-Lo authority
  employees/<id>.md          4 files
  lexias/<employee>-<flavor>-<dimension>.md   64 files
  variant-groups.lock.json   snapshot of which lexias agree
```

`content/` sits outside Eleventy's input directory, so it is never rendered as pages and
needs no `ignores` entry. It does need `addWatchTarget`, which `eleventy.config.js` sets.

**Lexia file.** Frontmatter, then the policy text and nothing else -- no headings, no
trailing notes. That body contract is what keeps `npm run drift` a plain string compare
and keeps the ` -- ` convention out of reach of a markdown renderer.

```yaml
---
id: lux-green-security          # must equal the filename stem
employee: lux
flavor: green
posture: guardrails             # derived from flavors.json, validated to agree
dimension: security
setting: Hi                     # derived from flavors.json, validated to agree

status: unreviewed              # unreviewed | in-review | approved | flagged
reviewer: ""
reviewed: ""                    # YYYY-MM-DD
notes: |

tags:
  - employee/lux
  - flavor/green
  - posture/guardrails
  - dimension/security
  - setting/hi
  - arc/pivot                   # this dimension is the one the scenario turns on
  - verdict/violation           # employee is not compliant under this flavor

rationale: |
implementation_note: |
---
The caseworker may use the county's designated AI screening tool to ...
```

`posture` and `setting` are written in for diff legibility but are never a second source
of truth; on conflict `content/flavors.json` wins and validation fails.

Tags in the seven derived namespaces are regenerated by `npm run scaffold`; tags outside
them are preserved, so a hand-added `topic/pii` survives.

`rationale` and `implementation_note` are intentionally empty. The only non-invented
source for them is the Hi/Lo text in 4.3, which yields eight distinct paragraphs across
64 files -- the Security-Hi text would appear verbatim in twelve. A populated `rationale`
reads as reviewed content, so filling it with a restated definition would mean 64 files
that look reviewed and are not.

**Employee file.** The scenario is a body section rather than a YAML scalar because it
contains ` -- `, and quoting that in YAML is how an em dash eventually gets in.

```yaml
---
id: lux
number: 1
name: Lux
role: DSS Caseworker
violatedDimension: security
compliantUnder: [yellow]
---

## Scenario

Lux is a caseworker at ...

## Violation question

Did Lux violate the policy?
```

**Why 64 files and not 48.** The cells hold only 48 unique texts: 19 of the 32
(employee, dimension, setting) groups are byte-identical across the flavors sharing that
setting, and 13 diverge. Storing the deduplicated form would bake the current
deduplication in as though it were intentional, and would mean editing one file silently
changes up to three rendered policies. One file per cell keeps every cell independently
addressable, keeps parallel reviewers off each other's merge conflicts, and turns the
deduplication into a finding: `npm run lint:lexias` reports it, and
`content/variant-groups.lock.json` guards its shape. Do not "optimise" the file count.

## 5. Phase 2: `data.json`

Built by `scripts/build-data.mjs`, which reads `content/` (4.4) plus the vendored
dimension definitions (4.3). It replaced `scripts/extract.mjs`, which parsed the
monolithic v5 document; references to `extract.mjs` below are historical.

`data.json` is the **only** coupling point between content and the templates:
`src/_data/policy.js` and `src/_data/combos.js` are three-line re-exports of it. Holding
its shape is what allowed the entire content pipeline to be replaced underneath without
touching a single template or changing a single rendered page.

`build-data.mjs` is a pure function of its inputs. `meta.generated` used to be
`new Date()`, which dirtied `data.json` on every run and quietly undercut the "the
data.json diff is the review artifact" workflow in TOOLING 4.4. Both `meta.version` and
`meta.generated` now come from `content/meta.json` and track the **source material**,
which is also what releases are tagged against (TOOLING 4.5). Purity is what makes the
staleness check in 5.3.17 possible at all.

### 5.1 Schema

`scripts/build-data.mjs` emits `data.json` at the repo root with exactly this
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

### 5.2 Reading the content tree

1. `content/flavors.json` gives the flavors, in array order. That order drives nav tabs,
   compare and matrix columns, print packet order, and PDF generation order.
2. `content/employees/*.md` gives the four employees. Frontmatter is parsed with
   `gray-matter`; `scenario` and `violationQuestion` come from the two `##` body
   sections.
3. `content/lexias/*.md` gives the 64 paragraphs. The body is the text, with leading and
   trailing newlines stripped and nothing else touched.
4. Paragraphs are emitted per flavor in `PARAGRAPH_ORDER`
   (`["security", "efficiency", "innovation", "accountability"]`), **never** in
   filesystem or alphabetical order. See 4.1.5.
5. `posture` is read from `content/flavors.json` but is deliberately **not** emitted into
   `data.json`: it exists to key lexia frontmatter and to survive a colour relabelling,
   and `label` already carries the human-readable form.
6. Preserve all internal punctuation exactly, including ` -- `.

**On the YAML dependency.** The old rule here said to hand-parse frontmatter rather than
add a YAML dependency, because the `violation arc` key contains a space. That construct
no longer exists, so the constraint is retired: `gray-matter` is now a declared
`devDependency`. It was already present transitively via Eleventy, so nothing new
installs -- but relying on an undeclared transitive dependency is how a minor Eleventy
bump breaks the build. The two frozen/vendored files are still hand-parsed, by
`scripts/lib/frontmatter.mjs` and `scripts/lib/parse-v5.mjs`.

### 5.4 `review.json`

A second artifact, written by the same script, carrying everything the review pages need:
per-lexia review state and tags, the 32 variant groups with precomputed word-level diffs,
status counts, and a `driftFromV5` badge per lexia.

**It exists because 5.1 forbids additional top-level keys in `data.json`.** Do not
"simplify" by merging them. Keeping the rendering data and the editorial data apart is
what lets `data.json` stay a stable contract while review state changes freely.

Diffs are precomputed in Node (`scripts/lib/word-diff.mjs`) rather than in the browser,
because section 0 requires the review pages to work with JavaScript disabled.

### 5.3 `scripts/validate.mjs`

Collects every failure before exiting non-zero, so one run surfaces everything wrong.

Checks run against data **rebuilt from `content/`**, not against the committed
`data.json`. The tree is the source of truth, and validating the artifact would let a
stale artifact mask a real content error -- the checks would confirm yesterday's correct
data while today's tree was broken. Staleness is a separate finding (17).

1. Exactly 4 employees, ids `lux`, `puk`, `jam`, `wow`.
2. Each employee has exactly 4 flavors.
3. Each flavor has exactly 4 paragraphs, dimensions in `PARAGRAPH_ORDER`.
4. Each paragraph text is non-empty and longer than 40 characters.
5. `content/flavors.json` is coherent: four distinct postures, each matching the
   coordinates in 4.1.6, and `data.json`'s copy agrees. Formerly a re-parse of the
   source's 16 config lines; now checked against all 64 lexia settings by check 13.
6. Exactly 4 dimensions, each with non-empty `hi`, `lo`, and an `operativeQuestion`
   ending in `?`.
7. Every Accountability-Hi paragraph contains `not the AI tool`. A known v5 fix;
   regression here is silent and serious. The flavor list is **derived** from which
   flavors set Accountability Hi, not hard-coded to two colours.
8. **Warn, do not fail**, if the frozen document's violation arc names an employee with
   no file in `content/employees/`. Catches the orphaned `Zip` entry. This is the only
   remaining intentional read of the frozen document.

The lexia tree (4.4):

9. Exactly 64 files in `content/lexias/`, and nothing else in that directory.
10. Every (employee, flavor, dimension) triple present exactly once. Missing and
    duplicate are reported separately: a rename collision presents as *missing*, and
    saying so points at the actual mistake.
11. Frontmatter `id`, `employee`, `flavor` and `dimension` agree with the filename.
12. Coordinates are in range.
13. `posture` and `setting` agree with `content/flavors.json`.
14. `status` is in the enum; `approved` and `flagged` require a non-empty `reviewer` and
    a parseable `reviewed` date. Catches "marked approved, no idea by whom".
15. Body is non-empty, contains no bare `---` line, and no em dash, en dash or curly
    quote. See 4.1.8.
16. Each employee's `compliantUnder` maps to the expected **postures**. See 4.2.
17. The committed `data.json` matches what `build-data.mjs` would emit.

**Expectations are keyed by posture, never by colour** (checks 5 and 16), and anything
that varies by colour is derived from `content/flavors.json`. Postures and their
coordinates are stable; the colour labelling them is not, and has already been reassigned
once upstream. This is what stops a relabelling from quietly redefining Guardrails, and
it means a colour migration needs no edit to this file.

Print a summary: `64 lexias, 16 policies, 4 dimensions, 0 errors, 1 warning`.

## 6. Phase 3: Core mechanics

### 6.1 Page inventory

26 content pages, 21 print pages, and 102 review pages. Output paths are exact.

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
| Review index | `site/review/index.html` | 1 |
| Review, status facet | `site/review/status/<status>/index.html` | 4 |
| Review, lexia detail | `site/review/lexias/<lexia>/index.html` | 64 |
| Review, group index | `site/review/variants/index.html` | 1 |
| Review, group detail | `site/review/variants/<group>/index.html` | 32 |

`<job>` is `lux|puk|jam|wow`. `<flavor>` is `green|red|blue|yellow`. `<status>` is
`unreviewed|in-review|approved|flagged`. `<lexia>` is `<job>-<flavor>-<dimension>`.
`<group>` is `<job>-<dimension>-<hi|lo>`.

The review pages ship in every build, including the public deploy and the portable zip.
**They publish review state**, reviewer names and notes included; the site sends
`noindex` but is not access controlled.

The four status facet pages *are* the status filter. Rendering each facet as its own page
rather than filtering client-side is what keeps them working with JavaScript disabled
(section 0). They add no client JS and no new asset.

Review pages are excluded from PDF rendering, which only walks `site/print/*`, so the
21-PDF count is unaffected.

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
- [ ] 16 policy texts render word for word identical to `content/lexias/`, including ` -- `
- [ ] All 4 dimension definitions render with operative questions
- [ ] Every job x flavor page shows the compliance verdict from 4.2
- [ ] Both risk callouts from 7.5 appear on the correct pages, and nowhere else

**Round-trips** — the two properties that prove the content survived being split apart
- [ ] `node scripts/migrate-lexias.mjs` rebuilds a `data.json` deep-equal to the
      committed one, `meta` aside. A strict `JSON.stringify` comparison; a trimmed or
      count-based check would pass while the text had silently changed.
- [ ] `npm run workshop-doc -- --check` reproduces the frozen v5 document byte for byte,
      apart from the `Zip` arc line. A lossy renderer would mean the printed packet is
      not the same document as the website.
- [ ] `npm run drift` reports every lexia identical to the frozen document, until someone
      deliberately edits one

**Portability, the primary requirement**
- [ ] `site/` opened via `file://` works fully: every link, every page, the diff view
- [ ] Zero occurrences of `href="/` or `src="/` in the built output
- [ ] Zero occurrences of `fetch(` or `type="module"` in the built output
- [ ] Moving `site/` to a different directory breaks nothing

**Build**
- [ ] `npm run all` succeeds from a clean checkout in under 2 minutes
- [ ] `npm run validate` exits 0 with the orphaned-`Zip` warning shown
- [ ] `npm test` passes: rel-filter units, workshop-doc round-trip, divergence lockfile,
      derived-tag freshness
- [ ] 21 PDFs in `site/pdf/`, each with a readable provenance footer and page numbers
- [ ] `site/` and `dist/` are gitignored and absent from `git status`
- [ ] `npm run build:data` twice in a row leaves `git status` clean; the build is a pure
      function of `content/`

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
