# `content/` — the editable source of truth

Everything the site says about policy lives here, as ordinary Markdown and JSON that a
person edits directly. `scripts/build-data.mjs` reads this tree and writes `data.json`,
which is what the Eleventy templates consume. See docs/BUILD-SPEC.md sections 4.4 and 5.

This directory sits **outside** Eleventy's input directory (`src/`), so Eleventy never
renders these files as pages. It is watched during `npm run dev` via an explicit
`addWatchTarget` in `eleventy.config.js`.

| Path | What it holds |
|---|---|
| `flavors.json` | The four policy flavors: id, display name, posture label, character string, and the Hi/Lo configuration of the four dimensions. |
| `employees/*.md` | The four employees: role, scenario, violation question, and which flavors they are compliant under. |
| `lexias/*.md` | The 64 policy paragraphs, one per (employee × flavor × dimension) cell. |
| `variant-groups.lock.json` | A snapshot of which lexias are byte-identical to each other. `npm run lint:lexias -- --fail-on-change` compares against it. |

## Why `flavors.json` is one file and not four

It is the single authority for the flavor ↔ posture ↔ Hi/Lo mapping. Before this file
existed, that mapping was written out in three places that nothing forced to agree: the
`FLAVORS` array in `scripts/extract.mjs`, `EXPECTED_FLAVOR_CONFIG` in
`scripts/validate.mjs`, and the configuration line repeated sixteen times inside
`src/sources/workshop-1-policy-texts-v5.md`.

Keeping it in one ordered array means a relabelling — such as the July 2026 colour
reassignment — is an edit to this file plus a scripted rename, rather than a change
scattered across the codebase. Four separate `flavors/<id>.md` files would reintroduce
exactly the scatter this is meant to remove.

The array **order** is meaningful: it drives navigation tab order, the compare and matrix
column order, the print packet order, and the order PDFs are generated in.

## Why the lexias are 64 files and not 48

The 64 cells contain only 48 unique texts — 19 of the 32 (employee × dimension × setting)
groups are byte-identical across the flavors that share a setting, and 13 genuinely
diverge. Storing 48 deduplicated clauses would bake the current deduplication in as though
it were intentional, and would mean editing one file silently changes up to three rendered
policies.

One file per cell keeps every cell independently addressable and diffable, keeps parallel
reviewers off each other's merge conflicts, and turns the deduplication into a *finding*:
`npm run lint:lexias` reports which groups agree and which diverge, so the 13 divergences
get reviewed rather than assumed.

## Editing

```
# edit content/lexias/<id>.md
npm run build:data          # regenerate data.json and review.json
git diff content/ data.json # the reviewable record of what changed
npm run validate            # 0 errors, 1 expected "Zip" warning
npm run lint:lexias         # has the divergence shape changed?
npm run drift               # how far has this moved from the v5 workshop text?
```

`src/sources/workshop-1-policy-texts-v5.md` is **frozen**. It is retained as the
provenance record of what the June 10 workshop actually produced, and is read only by
`npm run drift` and by the orphaned-name check in `scripts/validate.mjs`. Do not edit it.
`src/sources/operational-dimension-definitions.md` is different: it remains a live
vendored input, owned upstream in the private `herk` repo, and is still synced rather than
edited here.
