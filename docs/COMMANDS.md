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
| `npm test` | Unit test for the `rel` filter | After touching URL handling |
| `npm run check` | Portability lint over built output | Before every release |
| `npm run preview` | Opens `site/index.html` as a **file://** URL | The real offline test |
| `npm run extract` | Sources to `data.json` and `src/assets/data.js` | After editing `src/sources/` |
| `npm run validate` | Consistency checks on `data.json` | After extract |
| `npm run pdfs` | Playwright renders 21 PDFs into `site/pdf/` | Before release |
| `npm run all` | `build` + `pdfs` + `check` | Full local build |
| `npm run portable` | `all` + zips to `county-ai-roles-v5.0.0.zip` | Sending to a colleague |

Commands marked as producing `data.json` or PDFs depend on `scripts/extract.mjs`,
`scripts/validate.mjs`, and `scripts/render-pdfs.mjs`, which are specified in
`BUILD-SPEC.md` sections 5 and 8 and not yet written.

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
`eleventy.config.js`: `data.json`, which lives at the repo root and would otherwise be
invisible to the watcher. That matters because editing a source document and running
`npm run extract` in a second terminal will correctly trigger a rebuild.

Stop with `Ctrl-C`. Change the port with `npx eleventy --serve --port=3000`, or edit
`setServerOptions` in `eleventy.config.js`.

### 3.2 Before sending anything to anyone

```bash
npm run clean && npm run all && npm run preview
```

`all` runs build, PDFs, and the portability check in sequence and stops on the first
failure. `preview` then opens the result as a `file://` URL so you see what the
recipient sees. Click through every section, including the diff view.

### 3.3 Content changed in `herk`

```bash
# copy the updated markdown into src/sources/ first
npm run extract
git diff data.json     # the reviewable record of what actually changed
npm run validate
npm run dev
```

`data.json` is committed deliberately, so its diff is the review artifact for a
content change. See TOOLING-AND-DEPLOYMENT.md section 4.4.

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
├── scripts/
│   ├── lib/rel.mjs         # relative URL resolution
│   ├── test-rel.mjs        # 9/9 passing
│   ├── check-portable.mjs  # portability lint
│   ├── preview.mjs         # file:// preview
│   └── zip.mjs             # offline archive
├── src/
│   ├── _includes/base.njk  # minimal layout
│   ├── _data/              # empty; combos.js goes here (BUILD-SPEC 6.1)
│   ├── sources/            # empty; vendored markdown goes here (BUILD-SPEC 2.4)
│   ├── assets/styles.css   # design tokens, base typography
│   └── index.njk           # placeholder landing page
└── docs/
```

`npm install` adds 132 packages. A build currently takes about 0.2 seconds.

Not yet written, all specified in `BUILD-SPEC.md`: `extract.mjs`, `validate.mjs`,
`render-pdfs.mjs`, the 26 content pages, the 21 print pages, and the client JS.

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
