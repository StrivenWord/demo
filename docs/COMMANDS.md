---
title: Command Line Reference
project: county-ai-roles
date: 2026-09-13
status: Working; verified against the installed toolchain
---

# Command Line Reference

Everything runs through `npm run`. There is no global install, no task runner, and no
config beyond `package.json` and `eleventy.config.js`.

```bash
cd county-ai-roles
npm install          # once
npm run dev          # start working
```

## 1. The commands

| Command | What it does | When |
|---|---|---|
| `npm run dev` | Eleventy dev server on **http://localhost:8080**, live reload, incremental rebuilds | Day-to-day authoring |
| `npm run watch` | Rebuilds `site/` on change, no server | Watching output files directly |
| `npm run build` | One-shot build to `site/` | Before checking or deploying |
| `npm run clean` | Deletes `site/` | When output looks stale |
| `npm test` | `rel` units, workshop-doc round-trip, divergence lockfile, tag freshness | After touching URLs, content, or tags |
| `npm run check` | Portability lint over built output | Before every release |
| `npm run preview` | Opens `site/index.html` as a **file://** URL | The real offline test |
| `npm run build:data` | `content/` to `data.json`, `review.json`, `src/assets/data.js` | After editing `content/` |
| `npm run validate` | 17 consistency checks on `content/` and `data.json` | After build:data |
| `npm run pdfs` | Playwright renders 21 PDFs into `site/pdf/` | Before release |
| `npm run all` | `build` + `pdfs` + `check` | Full local build |
| `npm run portable` | `all` + zips to `county-ai-roles-v5.0.0.zip` | Sending to a colleague |

**Review and provenance**

| Command | What it does | When |
|---|---|---|
| `npm run lint:lexias` | Which of the 64 paragraphs agree with each other, and which do not | Reviewing; after editing a paragraph |
| `npm run lint:lexias -- --fail-on-change` | Fails if the divergence shape moved from the lockfile | CI; runs inside `npm test` |
| `npm run lint:lexias -- --write-lock` | Records the current shape as intended | After a deliberate divergence change |
| `npm run drift` | How far `content/` has moved from the frozen v5 workshop document | Before presenting the material |
| `npm run drift -- --full` | The same, with complete word-level diffs | Investigating a change |
| `npm run workshop-doc` | Rebuilds the single printable document into `dist/` | Printing a packet |
| `npm run scaffold` | Regenerates derived tags on every lexia | After changing employees or flavors |
| `npm run migrate` | One-shot: rebuilds `content/lexias/` from the frozen v5 document | Never, ordinarily |

`npm run extract` still works as a deprecated alias for `npm run build:data` and prints
a warning.

`npm run migrate --force` overwrites the whole lexia tree, discarding review state and
any edits. It exists as the record of how the tree was produced, not as a routine command.

## 2. The one thing to understand about this project

**`npm run dev` is more forgiving than reality.**

The dev server speaks HTTP. It resolves root-absolute paths like `/assets/styles.css`
and directory URLs like `/jobs/lux/`. A filesystem does neither. So the site can look
perfect on localhost and be completely broken when a colleague opens the folder,
which is the primary requirement (BUILD-SPEC section 0).

Three defenses, in increasing order of authority:

```bash
npm test        # is the rel filter correct?
npm run check   # does the built output contain anything file:// cannot handle?
npm run preview # open the actual thing the way a colleague will
```

`npm run preview` is the only one that proves it. Run it before any release.

### 2.1 What `npm run check` catches

`scripts/check-portable.mjs` scans every built `.html`, `.js`, and `.css` file:

| Rule | Level | Why |
|---|---|---|
| `href="/…"` or `src="/…"` | error | Resolves to the filesystem root under `file://` |
| `href="…/"` (directory link) | error | `file://` does not resolve `index.html` |
| `fetch(` or `XMLHttpRequest` | error | Blocked; origin is `null` under `file://` |
| `type="module"` | error | Blocked by the same CORS rules |
| External SVG `<use href="x.svg#i">` | error | Blocked |
| `href="https://…"` | warn | Fails offline; fine for human-facing reference links |

Errors exit non-zero. Output names the file and line, and states the fix.

### 2.2 A dev-server artifact you can ignore

The dev server injects its own live-reload client into served pages:

```html
<script type="module" src="/.11ty/reload-client.js"></script>
```

That is an absolute-path ES module, which is exactly what section 2.1 forbids. It is
injected at serve time only and **does not appear in `site/`**. Verified. Do not try to
suppress it, and do not run the portability check against served HTML; `npm run check`
reads the built output, which is clean.

## 3. Workflows

### 3.1 Authoring

```bash
npm run dev
```

Serves on `http://localhost:8080` and rebuilds on save. `--incremental` means only
changed templates rebuild, so saves are near-instant.

Watched automatically: everything under `src/`. Watched explicitly via
`eleventy.config.js`: `data.json`, `review.json` and `content/`, all of which live
outside the Eleventy input directory and would otherwise be invisible to the watcher.

Note what this does and does not give you. Editing a lexia triggers a rebuild, but the
rebuild reads `data.json`, which has not changed yet -- so the page will not update
until you run `npm run build:data`. That is deliberate: an edit visibly doing nothing is
a clearer signal than a stale page that looks fresh.

Stop with `Ctrl-C`. Change the port with `npx eleventy --serve --port=3000`, or edit
`setServerOptions` in `eleventy.config.js`.

### 3.2 Before sending anything to anyone

```bash
npm run clean && npm run all && npm run preview
```

`all` runs build, PDFs, and the portability check in sequence and stops on the first
failure. `preview` then opens the result as a `file://` URL so you see what the
recipient sees. Click through every section, including the diff view.

### 3.3 Changing a policy paragraph

Policy text is authored **in this repo**, one paragraph per file. It is no longer edited
upstream in `herk` and copied in.

```bash
# edit content/lexias/<employee>-<flavor>-<dimension>.md
npm run build:data
git diff content/ data.json   # the reviewable record of what actually changed
npm run validate              # 0 errors, 1 expected "Zip" warning
npm run lint:lexias           # did paragraphs that should agree stop agreeing?
npm run drift                 # how far is this from the workshop text now?
npm run dev
```

Both diffs are review artifacts: `content/` shows the prose in context, `data.json`
shows it structurally. See TOOLING-AND-DEPLOYMENT.md section 4.4.

Watch for two things. Editors autocorrect ` -- ` into an em dash and straight quotes
into curly ones; `npm run validate` fails on both. And `compliantUnder` in
`content/employees/*.md` drives every Compliant/Violation verdict on the site.

Dimension definitions are different: `src/sources/operational-dimension-definitions.md`
is still vendored from `herk`. Copy a newer version in by hand, then `npm run build:data`.

### 3.4 Shipping the offline folder

```bash
npm run portable
```

Produces `county-ai-roles-v5.0.0.zip` from `package.json`'s version field. The archive
expands to loose files rather than a nested folder, so the recipient unzips and
double-clicks `index.html`. No server, no install, no network.

## 4. What is configured, and why

`eleventy.config.js` carries four settings that exist purely to protect portability.
Each is commented `PORTABILITY` in the file.

| Setting | Effect |
|---|---|
| `addFilter("rel", …)` | Converts root-relative targets to page-relative paths. Every internal URL goes through it. |
| `setServerPassthroughCopyBehavior("copy")` | Dev server serves real copied assets, so what you see matches what `build` writes. Passthrough mode resolves asset URLs differently and can hide a broken path until deploy. |
| `addWatchTarget("./data.json")` | `data.json` sits outside `src/` and is not watched by default. |
| `domDiff: false` | Full page reload instead of DOM patching. Client state lives in `location.hash`; a partial patch can leave page and hash disagreeing, which looks like a bug in the diff view. |

Output directory is `site/`, set in the returned `dir` object. It is gitignored.

### 4.1 The `rel` filter

The implementation lives in `scripts/lib/rel.mjs`, separate from the config, so it can
be tested without booting Eleventy. `npm test` runs nine cases:

```
pass  /index.html                    /assets/styles.css  -> ./assets/styles.css
pass  /jobs/lux/index.html           /assets/styles.css  -> ../../assets/styles.css
pass  /jobs/lux/green/index.html     /assets/styles.css  -> ../../../assets/styles.css
pass  /jobs/lux/                     /assets/styles.css  -> ../../assets/styles.css
pass  /jobs/lux/green/index.html     /pdf/lux-green.pdf  -> ../../../pdf/lux-green.pdf
```

It strips the trailing filename before counting depth, so trailing-slash and
`index.html` permalinks behave identically. In templates:

```njk
<link rel="stylesheet" href="{{ '/assets/styles.css' | rel }}">
<a href="{{ '/jobs/lux/green/index.html' | rel }}">Lux under Green</a>
```

Always pass a root-relative target starting with `/`. Never write a raw internal
`href`.

## 5. Current state

Verified working:

```
county-ai-roles/
├── package.json            # the commands in section 1
├── eleventy.config.js      # section 4
├── .gitignore  .nojekyll
├── content/                # THE SOURCE OF TRUTH
│   ├── lexias/             # 64 policy paragraphs, one per file
│   ├── employees/          # 4 employees: scenario, question, verdicts
│   ├── flavors.json        # flavor / posture / Hi-Lo authority
│   ├── meta.json           # version and date of the material
│   └── variant-groups.lock.json
├── scripts/
│   ├── lib/                # taxonomy, frontmatter, parse-v5, lexias, groups, word-diff, rel
│   ├── build-data.mjs      # content/ -> data.json + review.json
│   ├── validate.mjs        # 17 checks
│   ├── lint-lexias.mjs  drift.mjs  render-workshop-doc.mjs  scaffold-template.mjs
│   ├── migrate-lexias.mjs  # one-shot, kept as the record of the split
│   ├── test-rel.mjs        # 9/9 passing
│   ├── check-portable.mjs  preview.mjs  zip.mjs  render-pdfs.mjs
├── src/
│   ├── _includes/          # base, nav, footer, macros, print
│   ├── _data/              # policy, combos, review, reviewStatuses, riskCallouts
│   ├── sources/            # frozen v5 document + vendored dimension definitions
│   ├── assets/             # styles.css, scripts.js
│   ├── index.njk  about.njk
│   ├── jobs/  policies/  print/  review/
└── docs/
```

`npm install` adds 132 packages. A full build writes 150 pages in about 1.2 seconds.

Built and verified: 26 content pages, 21 print pages, 102 review pages, 21 PDFs, and the
client diff view.

## 6. Troubleshooting

**`npm install` fails with `EACCES` on `~/.npm/_cacache`.** Permissions on the shared
npm cache. Use a local one: `npm install --cache ./.npm-cache` (already gitignored via
`.cache/`, or add it).

**Port 8080 in use.** `npx eleventy --serve --port=3000`.

**Changes not appearing.** If you edited something outside `src/`, it may not be
watched. `data.json` is the only external watch target. Restart `npm run dev`.

**Site works on localhost, broken from disk.** The failure this project is built to
prevent. Run `npm run check`; it names the file, the line, and the fix.

**Stale output.** `npm run clean && npm run build`. Eleventy does not remove files whose
source templates were deleted.
