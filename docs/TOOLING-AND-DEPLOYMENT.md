---
title: Tooling and Deployment Practices
project: county-ai-roles
date: 2026-09-13
status: Decided
supersedes: COUNTY_AI_ROLES_DESIGN_SPEC.md section 5.3 (framework options) and section 5.4 (build process)
---

# Tooling and Deployment Practices

## 1. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Site generator | Eleventy (11ty) v3 | Node-native, composes with the extraction scripts in one toolchain. Pre-renders every job x flavor state as a real page, which is required anyway because those pages are the PDF print source. |
| Repository | New repo, `county-ai-roles` | The `herk` repo is private and holds personnel and budget material. It cannot be made public, and free-tier GitHub Pages publishes only from public repos. |
| Source of truth | `content/` in this repo | **Changed 2026-09-14.** Policy text is authored here, one paragraph per file. The v5 workshop document under `src/sources/` is frozen as provenance; only `operational-dimension-definitions.md` remains a live vendored input from `herk`. |
| PDF rendering | Playwright (headless Chromium), post-build | Prints the same HTML the site serves, so "identically formatted" is structurally guaranteed rather than maintained by hand. |
| PDF storage | Built in CI, never committed | Keeps binary churn out of git history. Distributed as a workflow artifact and release asset. |
| PDF branding | Provenance footer only | Source file, version, generation date, page numbers. No county seal. |
| **Requirement** | **A fully static site built to `site/`** | The only hard requirement. No server, no absolute paths, no host-specific configuration. Everything below is downstream of this. |
| Hosting | Undecided; GitHub Pages accommodated | A contingency the build supports, not a dependency. Section 5 applies only if Pages is chosen; nothing else in this document depends on it. |
| Build output | `site/` | Gitignored. Consumed unchanged by every deployment target, including a zip opened from a filesystem. |
| Portability | Single build, `file://` safe | `site/` works both as the Pages artifact and as a folder opened directly from disk. |
| Search indexing | Excluded, `noindex` meta tag | Illustrative material naming a real county should not surface as adopted policy. Reversible after stakeholder sign-off. |

## 2. The portability constraint

A colleague must be able to unzip a folder, double-click `index.html`, and have the
whole site work with no web server. This is the single most constraining requirement
in the project, because under the `file:` scheme the page origin is `null` and the
browser applies cross-origin rules to local files.

### 2.1 What breaks under `file://`

| Technique | Status | Required approach |
|---|---|---|
| `fetch()` / `XMLHttpRequest` | Blocked in all major browsers | Inline the data; never fetch it |
| `<script type="module">` | Blocked (CORS on module scripts) | Classic scripts only, or bundle to an IIFE |
| Directory URLs (`option-a/`) | Shows a file listing, no index resolution | Link to `option-a/index.html` explicitly |
| Root-absolute paths (`/assets/x.css`) | Resolves to filesystem root | Relative paths only (`../assets/x.css`) |
| External SVG sprites (`<use href="s.svg#i">`) | Blocked | Inline every SVG |
| `history.pushState` | No meaningful effect | Use `location.hash` for client-side state |
| Service workers, caching APIs | Unavailable | Do not use |
| `localStorage` | Inconsistent, shared opaque origin | Do not rely on it |

Stylesheets via `<link>`, images, and classic `<script src>` all work normally.

**Web fonts are avoided entirely**, which removes the last `file://` unknown. Font
loading under the scheme varies by browser and directory depth, and the portable build
is not the place to gamble. Screen uses a native system stack; print pins Liberation
Sans. See DESIGN-SYSTEM.md section 5.1.

### 2.2 The single-build consequence

Every constraint above is *also valid on the web*. Relative paths, explicit
`index.html`, and inlined data all work fine over HTTP. Therefore there is **one
build**, not a web target and an offline target. `site/` is both.

A useful side effect: because no URL is root-absolute, the GitHub Pages `pathPrefix`
problem never arises. The same folder works at `https://org.github.io/county-ai-roles/`,
at a bare domain root, and at `file:///Users/you/Downloads/county-ai-roles/`.

### 2.3 Implementation rules

1. **Data delivery.** Emit `assets/data.js` containing `window.COUNTY_AI_DATA = {...};`
   and load it with a classic `<script src>`. Do not emit a `.json` file for the
   browser to fetch. Keep `data.json` in the repo as the build-time artifact and
   review target; the `.js` wrapper is generated from it.
2. **Relative URLs.** Add an Eleventy filter that computes a relative path from the
   current `page.url` to any target. Apply it to every internal `href` and `src`.
   No exceptions, including the PDF download links.
3. **Explicit index.** All internal links end in `index.html` or a real filename.
4. **Classic scripts.** Either author plain classic JS, or add a bundling step that
   emits an IIFE. Given the scale, plain classic JS with no bundler is sufficient.
5. **Inline SVG.** Icons and dimension indicators are inlined into templates.
6. **Hash-based state.** Ephemeral UI state (open diff pair, expanded dimension) goes
   in `location.hash`. Durable state is expressed as a distinct pre-rendered page.
7. **Verify before release.** Build, then open `site/index.html` directly from disk
   and exercise both interfaces. This is a release gate, not a spot check.

## 3. Repository layout

```
county-ai-roles/
├── .github/workflows/
│   ├── build-deploy.yml       # main: build, PDFs, deploy to Pages
│   ├── pr-preview.yml         # PR: build only, upload site/ as artifact
│   └── portable.yml           # tag: build and attach the offline zip
├── docs/
│   ├── TOOLING-AND-DEPLOYMENT.md
│   └── RUNBOOK.md             # how to re-extract, rebuild, redeploy
├── scripts/
│   ├── build-data.mjs         # content/ -> data.json + review.json
│   ├── migrate-lexias.mjs     # one-shot: v5 document -> content/lexias/
│   ├── validate.mjs           # 17 consistency checks, exits nonzero on failure
│   ├── lint-lexias.mjs        # which lexias agree with each other
│   ├── drift.mjs              # how far content/ has moved from the frozen v5 document
│   ├── render-workshop-doc.mjs # content/ -> a single printable document
│   ├── scaffold-template.mjs  # derived tags on every lexia
│   ├── check-portable.mjs     # greps site/ for file:// hazards
│   └── render-pdfs.mjs        # Playwright pass over the built HTML
├── src/
│   ├── sources/               # v5 document (frozen) + dimension definitions (vendored)
│   ├── review/                # 102 review pages
│   ├── _data/                 # data.json consumed by Eleventy
│   ├── _includes/             # Nunjucks layouts and partials
│   ├── assets/                # styles.css, scripts.js (no fonts, see 2.1)
│   ├── index.njk              # Overview
│   ├── jobs/                  # job x flavor pages          (16 + 4)
│   ├── policies/              # flavor matrix and details    (1 + 4)
│   └── print/                 # 21 print-view pages, the PDF source
├── content/                   # THE SOURCE OF TRUTH: 64 lexias, 4 employees, flavors
├── site/                      # build output (gitignored)
├── .gitignore
├── .nojekyll
├── eleventy.config.js
└── package.json
```

Page routes follow DESIGN-SYSTEM.md section 4.3. Eleventy's output directory is set
to `site` in `eleventy.config.js`:

```js
export default function (eleventyConfig) {
  return { dir: { input: "src", output: "site", includes: "_includes", data: "_data" } };
}
```

### 3.1 What is committed

**Commit:** `content/` (the source of truth), `src/sources/` (frozen and vendored
markdown), `data.json`, `review.json`, all templates, styles, scripts, configuration,
workflows, docs.

**Do not commit:** `site/`, `dist/`, `node_modules/`, generated PDFs, generated
`assets/data.js`, zip archives, Playwright browser binaries.

Committing `data.json` is deliberate. It means the site builds without a `herk`
checkout, the build step is not on the critical path for a redeploy, and any change to
policy content shows up as a reviewable diff in a pull request. `build-data.mjs` is a
pure function of `content/`, so that diff is signal rather than noise -- it used to
stamp the build date and dirty the file on every run.

## 4. Git practices

These are shaped by one fact: **`main` is the published site.** Every merge deploys to
a public URL. The practices below exist to make that safe rather than nerve-wracking.

### 4.1 Branching

- `main` is the deploy branch. Every push to it publishes. There is no staging branch,
  because pull request previews serve that role better and cost nothing.
- Protect `main`. At minimum: require a pull request, require the build workflow to
  pass, and disallow force pushes. A force push to `main` can publish a site that no
  commit in history describes.
- Work on short-lived topic branches (`extract-v5`, `diff-view`, `print-stylesheet`).
- Never commit directly to `main` once the site is live. There is no undo on a
  deployment except another deployment.
- Linear history. Squash merge topic branches so each commit on `main` corresponds to
  exactly one deployment. When a deploy breaks something, `git revert <sha>` is then a
  complete and reviewable rollback rather than an archaeology exercise.

### 4.2 Pull request previews

Add a `pr-preview.yml` workflow that runs the full build on every pull request but
stops short of deploying, uploading `site/` as a workflow artifact instead. This gives
three things that matter for a repo where main is live:

1. A broken build is caught before it can reach the public URL.
2. Reviewers download one artifact and open `index.html` from disk, reviewing the
   real rendered site rather than a templating diff. The portability requirement makes
   this trivial; there is nothing to serve.
3. The PDF step runs on every PR, so a change that breaks print rendering surfaces in
   review rather than after deployment.

Use the same steps as `build-deploy.yml` minus `configure-pages` and `deploy-pages`,
and grant it `contents: read` only. A pull request workflow should never hold
`pages: write`.

### 4.3 Rollback

Because `main` is the site and history is linear:

```bash
git revert <bad-sha>     # creates a forward commit undoing the change
git push origin main     # redeploys the previous state
```

Do not roll back by re-running an older workflow. The deployment reflects whatever
`main` contains, so the tree and the live site must agree or the next merge will
silently resurrect the problem.

### 4.4 Content changes are code changes

**Upstream `herk` is no longer authoritative for policy paragraph text.** This repo is.
That is the single change here most likely to surprise someone six months from now, so it
is stated plainly rather than implied.

The previous instruction was to edit the source document in `herk`, copy it back in with
`npm run sync`, and re-extract. That workflow is gone. It was also never executable:
`scripts/sync-sources.mjs` was documented in four places in this file but has never
existed in the repository, so whoever last updated the sources did it with a manual file
copy.

To change a policy paragraph:

```bash
# edit content/lexias/<employee>-<flavor>-<dimension>.md
npm run build:data             # regenerates data.json and review.json
git diff content/ data.json    # the reviewable record of what changed
npm run validate               # 17 consistency checks
npm run lint:lexias            # did paragraphs that should agree stop agreeing?
npm run drift                  # how far is this from the workshop text now?
```

Open a pull request. Both diffs are review artifacts: `content/` shows the prose change
in context, `data.json` shows it in structured form. Merging deploys.

To change a **dimension definition**, the old workflow still applies, because
`src/sources/operational-dimension-definitions.md` is still vendored from `herk`: copy
the newer file in by hand, then `npm run build:data`.

### 4.5 Versioning and releases

Tag releases as `v5.0`, `v5.1`, `v6.0`, tracking the *source material* version rather
than a separate site version. The material's version and date live in
`content/meta.json`, and flow into `data.json`'s `meta` block and the PDF footer;
bump that file when you tag. The spec's section 7.1 update process maps onto this
directly. Tagging triggers the portable zip workflow, so every tagged version has a
downloadable offline archive permanently attached to it. That archive is the thing
you send colleagues, and it is reproducible years later.

### 4.6 .gitignore

```gitignore
node_modules/
site/
src/assets/data.js
*.zip
.cache/
.DS_Store
```

## 5. GitHub Pages setup (contingency)

**This entire section is conditional.** Hosting is not decided. The build produces a
plain static folder with relative URLs and no server requirements, so it deploys
unchanged to any of these:

| Target | How |
|---|---|
| Zip sent to a colleague | `npm run portable`, open `index.html` from disk |
| Any web server or file share | Copy `site/` to the document root |
| Netlify, Cloudflare Pages | Build `npm run all`, publish directory `site` |
| GitHub Pages | This section |

Nothing outside section 5 assumes GitHub Pages. If another host is chosen, replace this
section and change no code. Two things to carry over if you do switch: the `noindex`
decision in 5.4, which is host-independent, and the note in 5.4.3 that hosts supporting
custom headers (Netlify, Cloudflare) can close the PDF indexing gap that Pages cannot.

### 5.1 One-time configuration

1. Create the repo as **public** (required for Pages on the free org tier).
2. Settings > Pages > Build and deployment > Source: **GitHub Actions**. Do not select
   a branch. See 5.1.1 for why this is mandatory rather than preferred.
3. Settings > Actions > General > Workflow permissions: read-only is fine, because the
   workflow requests its own scoped permissions.
4. Add `.nojekyll` at the repo root. The Actions path does not run Jekyll, but this
   protects you if anyone ever switches deployment sources.
5. Protect `main` per section 4.1 before the first deploy, not after.

#### 5.1.1 Why branch deployment cannot be used

GitHub Pages offers two deployment sources. The branch option is the familiar one, and
it does not work here, for three independent reasons:

1. **It publishes only `/` or `/docs`.** Those are the only two folder choices GitHub
   offers; an arbitrary directory like `/site` is not selectable. Since `docs/` already
   holds project documentation, and publishing the repo root would expose `src/`,
   `scripts/`, and `node_modules` paths, neither option fits.
2. **It cannot run Playwright.** Branch deployment serves committed files. The 21 PDFs
   are generated at build time and deliberately never committed, so they would simply
   be absent from the published site.
3. **It runs Jekyll.** Harmless here, but pointless, and it silently drops files and
   directories beginning with an underscore.

Actions deployment has none of these limits: it uploads whatever folder you point it
at, after running whatever build you like. `site/` stays gitignored, PDFs are generated
fresh on every deploy, and nothing about the repo layout is constrained by Pages.

If GitHub Pages is ever abandoned for another host, note that this same property holds:
the deployable unit is a plain folder with relative URLs and no server requirements, so
only section 5 of this document would need replacing.

### 5.2 Build and deploy workflow

`.github/workflows/build-deploy.yml`:

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - run: npx playwright install --with-deps chromium

      # Pin the print typeface explicitly. Playwright's --with-deps pulls in fonts
      # transitively, but relying on a transitive dependency for typographic output
      # is exactly how PDFs silently change between runs.
      - name: Install deterministic print fonts
        run: sudo apt-get install -y --no-install-recommends fonts-liberation

      - run: npm run validate
      - run: npm run build      # eleventy
      - run: npm run pdfs       # playwright pass over site

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```

Caching the Chromium binary matters. Without it, `playwright install` alone costs
roughly a minute on every run.

### 5.3 Portable archive workflow

`.github/workflows/portable.yml` runs on tag push, performs the same build, then zips
`site/` and attaches it to the release. Colleagues download one file from the
Releases page, unzip, and open `index.html`. No server, no install, no network.

Because PDFs are never committed, this workflow is also the only supported way to
obtain a complete archive including all 21 PDFs without running the build locally.

### 5.4 Search indexing: excluded

**Decision: the site is published with search indexing disabled.** The material is
illustrative rather than adopted policy, and it names a real county. A search for
"Herkimer County AI policy" should not surface a draft that the county never adopted,
particularly since the risk callouts describe compliance failure modes that read as
findings about the county when taken out of context.

This is reversible in one line once stakeholders sign off. The reverse ordering is not,
which is why it ships closed.

#### 5.4.1 Implementation

One tag in the base layout, applied to every page:

```html
<meta name="robots" content="noindex, follow">
```

`follow` is deliberate. It lets crawlers walk the site and see the `noindex` on every
page, which is what actually keeps them out of the index.

Additionally, mark the 21 PDF links:

```html
<a href="../../pdf/lux-green.pdf" rel="nofollow">Download PDF (142 KB)</a>
```

#### 5.4.2 Why there is no robots.txt

`robots.txt` is only honored at a **domain root**. This is a project site at
`sunypolyaix.github.io/county-ai-roles/`, so the file crawlers actually read is
`sunypolyaix.github.io/robots.txt`, which belongs to the organization's user-pages
repository, not this one. A `robots.txt` placed in this site's output is ignored.

Do not add one. It would imply a protection that does not exist.

Note also that `robots.txt` blocks *crawling*, not *indexing*. A blocked URL can still
be listed without a snippet. And blocking a page prevents crawlers from ever seeing its
`noindex` tag, so the two mechanisms actively interfere. The meta tag alone is both
necessary and sufficient for HTML.

#### 5.4.3 The PDF gap

**The 21 PDFs cannot be excluded from search on a `github.io` project path.** A PDF has
no `<head>` for a meta tag, the `X-Robots-Tag` header is unavailable because GitHub
Pages does not permit custom headers, and `robots.txt` does not apply per 5.4.2. Google
does index PDFs.

The `rel="nofollow"` in 5.4.1 is mitigation, not a fix: it discourages crawlers from
following links to the PDFs, and since every page linking to them is itself `noindex`
and the site is not linked externally, discovery is unlikely in practice. It is not
guaranteed.

Two airtight alternatives exist if the exposure is unacceptable:

1. **Use a custom domain** (section 5.5). At a domain root, `robots.txt` works, and
   `Disallow: /pdf/` becomes effective.
2. **Do not publish PDFs to the site.** Distribute them only in the tagged release zip.
   This contradicts the click-to-download requirement and is not the current plan.

The current plan accepts the residual exposure knowingly.

#### 5.4.4 Indexing is not privacy

The repository is public, so every URL is public. Anyone with the link, or browsing the
organization's repositories, can read everything including the PDFs. `noindex` only
means the site does not surface to someone who was not already looking for it. If the
content genuinely must not be publicly readable, hosting must change, not metadata.

#### 5.4.5 Reversing this later

Remove the meta tag and the `rel="nofollow"` attributes, redeploy, and optionally
request crawling through Google Search Console. Do this only after stakeholders have
approved the content being publicly attributed to Herkimer County.

### 5.5 Custom domain (optional)

Add a `CNAME` file at the repo root containing the bare hostname, configure DNS, and
enable "Enforce HTTPS". Because every URL in the build is relative, moving between
`org.github.io/county-ai-roles/` and a custom domain requires no rebuild.

## 6. Build pipeline

```
herk/ (local checkout, private)
  └─ manual copy ───────────► src/sources/operational-dimension-definitions.md
                                                      [rare; the only live vendored input]

content/                                              [THE SOURCE OF TRUTH, committed]
  ├─ npm run build:data ────► data.json               [committed, reviewable]
  │                        └► review.json             [committed, review state]
  ├─ npm run lint:lexias ───► agreement report        [+ lockfile guard]
  ├─ npm run drift ─────────► distance from frozen v5 [report]
  └─ npm run workshop-doc ──► dist/*.md               [printable document, gitignored]

src/sources/workshop-1-policy-texts-v5.md             [FROZEN: provenance only]
  └─ read by drift.mjs and the Zip warning in validate.mjs

data.json + review.json
  ├─ npm run validate ──────► pass/fail               [CI gate]
  └─ npm run build ─────────► site/                  [11ty: 26 + 21 print + 102 review]

site/
  └─ npm run pdfs ──────────► site/pdf/*.pdf         [Playwright, 21 files]

site/  ──────────────────►  GitHub Pages   (deploy-pages)
        └───────────────►  county-ai-roles.zip   (release asset, file:// safe)
```

### 6.1 npm scripts

```json
{
  "scripts": {
    "build:data":   "node scripts/build-data.mjs",
    "validate":     "node scripts/build-data.mjs && node scripts/validate.mjs",
    "build":        "node scripts/build-data.mjs && eleventy",
    "test":         "rel units + workshop round-trip + lockfile + tag freshness",
    "lint:lexias":  "node scripts/lint-lexias.mjs",
    "drift":        "node scripts/drift.mjs",
    "workshop-doc": "node scripts/render-workshop-doc.mjs",
    "scaffold":     "node scripts/scaffold-template.mjs",
    "migrate":      "node scripts/migrate-lexias.mjs",
    "pdfs":         "node scripts/render-pdfs.mjs",
    "check":        "node scripts/check-portable.mjs",
    "all":          "npm run build && npm run pdfs && npm run check",
    "portable":     "npm run all && node scripts/zip.mjs"
  }
}
```

`npm run dev` gives a live-reload dev server but produces no PDFs, so download links
404 during development. Use `npm run all` before any portability check.

### 6.2 PDF output set

21 documents, all rendered from `src/print/`:

- 16 single sheets, one per job x flavor
- 4 per-job comparison packets, all four flavors in Green, Red, Blue, Yellow order
- 1 complete compendium, all 16 texts plus the dimension definitions, with a
  table of contents and continuous page numbering

### 6.3 Playwright notes

- Footers come from Playwright's `footerTemplate`, not CSS. Headless Chromium does
  not support CSS Paged Media margin boxes, so `@bottom-center` and `counter(page)`
  silently do nothing.
- `footerTemplate` requires an explicit inline `font-size`. Its default computed size
  is effectively zero, which renders an invisible footer and looks like a bug.
- Reserve space with `margin: { bottom: '0.6in' }` or the footer overlaps body text.
- Pass `printBackground: true`, otherwise risk callout backgrounds vanish.
- Load print pages via `file://` from `site/`, not over a dev server. This exercises
  the same code path colleagues will use and catches portability regressions in CI.
- The print stylesheet pins Liberation Sans rather than using the site's system font
  stack, because `system-ui` resolves differently on the Ubuntu runner than on macOS.
  See DESIGN-SYSTEM.md section 5.1. Without this the PDFs are not reproducible.

Point 5 is worth emphasizing: rendering the PDFs from the filesystem means the CI
build fails if anyone introduces an absolute path or a `fetch()` call. The portability
requirement becomes self-enforcing rather than a thing to remember.

## 7. Open items

1. **Hosting.** Deliberately open. The requirement is a static build in `site/`;
   GitHub Pages is accommodated in section 5 as a contingency. This does not block
   implementation and can be decided after the site is built.
2. ~~**Font strategy.**~~ **Resolved.** No web fonts. Native system stack on screen,
   pinned Liberation Sans for print and PDF. See DESIGN-SYSTEM.md section 5.1.
3. ~~**Search engine indexing.**~~ **Resolved: excluded.** `noindex` meta tag on every
   page, `rel="nofollow"` on PDF links, no `robots.txt`. See section 5.4. One known
   residual exposure: the PDFs cannot be excluded on a `github.io` project path (5.4.3).
4. **Repository visibility.** Public is required for free-tier Pages. If the
   `sunypolyaix` organization has a Team or Enterprise plan, a private repo with public
   Pages is possible. Worth confirming before creating the repo, since converting a
   public repo to private later does not unpublish what was already fetched or cached.
