---
title: Design System
project: county-ai-roles
date: 2026-09-13
status: Decided
supersedes: COUNTY_AI_ROLES_DESIGN_SPEC.md sections 4.1, 4.2, 4.3
---

# Design System

## 1. Concept

**A monochrome slate interface in which the only color is the policy data.**

Site chrome carries no hue. Active tabs, links, focus rings, and buttons are
expressed through slate weight, fill, and underline. The four policy flavors are the
sole source of color on any page, which means every colored pixel is load-bearing:
if something is colored, it is telling you which policy you are looking at.

Amber is not a separate UI accent. Amber *is* the Yellow flavor. The site reads as
slate and amber because amber is the warmest note in a otherwise neutral field, and
because Yellow (the least constrained, highest risk policy) is the flavor the eye
should catch.

### 1.1 Why the accent was removed

The spec set Yellow at `#d97706`, which is exactly amber-600. Amber and yellow occupy
the same hue family; across every usable lightness step they sit 3 to 9 degrees apart.
An amber UI accent would therefore be visually indistinguishable from a Yellow flavor
chip placed near it, and the flavor chips are the one thing on the page that must
never be ambiguous. Removing the UI accent resolves this permanently rather than
managing it per screen.

## 2. Color tokens

All values verified against WCAG 2.1. Ratios given for normal body text against the
stated surface. AA requires 4.5:1 for text and 3:1 for UI components and graphics.

### 2.1 Neutrals

| Token | Light | Dark | Role |
|---|---|---|---|
| `--surface` | `#ffffff` | `#0f172a` | page background |
| `--surface-sunken` | `#f8fafc` | `#020617` | scenario blocks, code, wells |
| `--surface-raised` | `#f1f5f9` | `#1e293b` | cards, inactive tabs |
| `--border` | `#e2e8f0` | `#334155` | hairlines, dividers |
| `--border-strong` | `#cbd5e1` | `#475569` | card outlines, table rules |
| `--text` | `#1e293b` | `#f1f5f9` | body copy |
| `--text-strong` | `#0f172a` | `#f8fafc` | headings, active tab |
| `--text-muted` | `#475569` | `#94a3b8` | captions, metadata, scenario |

`--text` on `--surface` is 14.63:1 light, 15.8:1 dark. `--text-muted` on `--surface`
is 7.58:1 light. Slate-400 (`#94a3b8`) is 2.56:1 on white and **must never appear on a
light background**; it is a dark-mode-only token.

### 2.2 Policy flavors

These supersede the spec's section 4.1 hex values. The originals were chosen for
identity, not contrast, and three of the four failed AA for text on white (green 3.77,
blue 3.68, yellow 3.19). These are the same hues moved to accessible steps.

| Flavor | Label | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|---|
| Green | Guardrails | `#047857` | 5.48 | `#34d399` | 9.29 |
| Red | Enable | `#b91c1c` | 6.47 | `#f87171` | 6.45 |
| Blue | Light-touch | `#0e7490` | 5.36 | `#22d3ee` | 9.88 |
| Yellow | Exposed | `#b45309` | 5.02 | `#fbbf24` | 10.69 |

All four clear AA for normal text in both themes. Exposed as
`--flavor-green`, `--flavor-red`, `--flavor-blue`, `--flavor-yellow`, plus a
`--flavor-current` set per page by the body class.

**Yellow is amber-700 / amber-400.** This is deliberate and is the palette's one
warm note.

### 2.3 Dimension colors

The spec's section 4.2 proposed a second color system for Security, Accountability,
Efficiency, and Innovation. **This is dropped.** Two competing color systems on one
page would defeat the concept in section 1, and dimension tags already carry text
labels plus Hi/Lo values, which is unambiguous without hue.

Dimensions are distinguished by a Hi/Lo treatment instead:

- **Hi**: filled slate chip, `--surface-raised` background, `--text-strong`, weight 600
- **Lo**: outlined chip, transparent background, `--border-strong` outline, `--text-muted`

This encodes the thing that actually matters (is this dimension constrained or not)
and survives grayscale printing, which the color version would not.

### 2.4 Never rely on color alone

WCAG 1.4.1. Every flavor indicator carries its name in text. Every dimension chip
carries its Hi or Lo value. Diff highlighting uses a left border and a change marker
in addition to background tint. Risk callouts carry an icon and the word "Risk" in
addition to their border.

## 3. Theme

Light and dark via `prefers-color-scheme` only. **No theme toggle.** A toggle needs
persistence, and `localStorage` is unreliable under the `file://` scheme that the
portable build depends on. Respecting the system setting works identically online and
offline with no script at all.

```css
:root { /* light tokens */ }
@media (prefers-color-scheme: dark) { :root { /* dark overrides */ } }
@media print { :root { /* forced light, see section 7 */ } }
```

## 4. Navigation

### 4.1 Three tab rows

```
┌──────────────────────────────────────────────────────┐
│  Overview  │▓▓ Jobs ▓▓│  Policies                    │  site
├──────────────────────────────────────────────────────┤
│   Lux   │   Puk   │   Jam   │   Wow                   │  job
│         │ ─────── │                                   │
├──────────────────────────────────────────────────────┤
│  Green  │  Red  │  Blue  │  Yellow  │  Compare        │  flavor
│ ═══════ │                                             │
└──────────────────────────────────────────────────────┘
```

Differentiated by weight, not by adding color:

| Row | Inactive | Active |
|---|---|---|
| Site | `--text-muted`, no rule | `--text-strong` on `--surface-raised`, filled |
| Job | `--text-muted` | `--text-strong`, 2px `--border-strong` underline |
| Flavor | `--text-muted` | `--flavor-current`, 3px underline in that flavor |

Only the third row is ever colored, and only its active tab.

### 4.2 Tabs are links, not widgets

Every tab is an `<a href>` to a pre-rendered page. **Do not use `role="tab"`,
`role="tablist"`, or `role="tabpanel"`.** That ARIA pattern describes panels swapped
within one document and implies keyboard behavior (arrow keys, roving tabindex) that
would be wrong here and would misreport the page to screen readers.

The correct markup is a labelled nav with current-page state:

```html
<nav aria-label="Job">
  <ul>
    <li><a href="../lux/green/index.html">Lux</a></li>
    <li><a href="../puk/green/index.html" aria-current="page">Puk</a></li>
  </ul>
</nav>
```

`aria-current="page"` is the accessible signal; the underline is its visual form.
Native link semantics give keyboard support, focus order, and open-in-new-tab for
free. Nothing here requires JavaScript.

### 4.3 URL scheme

All paths relative, all ending in an explicit filename, per the portability rules in
TOOLING-AND-DEPLOYMENT.md section 2.

```
index.html                          Overview
jobs/index.html                     Job index, redirects to first job
jobs/<job>/index.html               Compare tab: all four flavors
jobs/<job>/<flavor>/index.html      Single flavor            (16)
policies/index.html                 Policy matrix, 2x2
policies/<flavor>/index.html        Flavor detail            (4)
print/<...>/index.html              Print sources            (21)
pdf/<...>.pdf                       Generated PDFs           (21)
```

26 content pages. Every navigable state is a real URL that works offline, prints, and
can be pasted into an email.

### 4.4 Diff view

Diff is the one interaction that is not its own page. Pre-rendering it would add 24
pages (6 flavor pairs per job) for a feature used far less than the others. It is a
progressive enhancement on `jobs/<job>/index.html`:

- Without JS, that page shows all four flavors side by side, fully readable
- With JS, a pair selector collapses it to two columns with changes highlighted
- Selection is held in `location.hash` (`#diff=green,red`), not `pushState`

## 5. Typography

Per spec section 4.3, with values fixed.

| Element | Size | Line height | Weight | Color |
|---|---|---|---|---|
| Policy body | 16px | 1.7 | 400 | `--text` |
| Policy column | max-width 65ch | | | |
| Section header | 14px | 1.3 | 700 | `--text-strong` |
| | uppercase, 0.06em tracking | | | |
| Scenario | 15px | 1.65 | 400 | `--text-muted` |
| Violation question | 15px | 1.65 | 600 | `--text-strong` |
| Dimension chip | 12px | 1 | 600 Hi / 400 Lo | per 2.3 |
| Risk callout | 14px | 1.6 | 400 | `--text` |
| Tab label | 14px | 1 | 500 / 600 active | per 4.1 |

**System font stack, no web fonts.** Web font loading under `file://` varies by
browser and directory depth, and resolving that is not worth the risk to the portable
build. The stack below renders well on every target platform and costs zero bytes:

```css
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

### 5.1 Screen stack versus print stack

The screen and the PDFs have different goals, so they get different stacks.

**Screen** uses the native system stack above, so the site feels correct on each
platform. Metrics vary between macOS, Windows, and Linux; that is the point.

**Print gets a pinned, deterministic stack.** The PDFs render on an Ubuntu CI runner,
where `system-ui` resolves to whatever the container happens to have installed, not to
the face you see on macOS. Left alone, the generated PDFs would differ in face and
metrics from the website, which undercuts the "identically formatted" requirement and
makes the output non-reproducible between machines.

```css
@media print {
  body {
    font-family: "Liberation Sans", "Helvetica Neue", Arial, sans-serif;
  }
}
```

Liberation Sans is metric-compatible with Arial and is installed explicitly in CI
(see TOOLING-AND-DEPLOYMENT.md section 5.2). The result is a PDF that renders
identically on the runner, on a developer's machine, and on a rebuild years from now
against a tagged release.

A serif stack is available for the print views if a more document-like register is
wanted; use `"Liberation Serif", "Times New Roman", serif` so the same determinism
holds.

**No em-dashes** in any UI string or generated text, per project style. Use semicolons
or restructure.

## 6. Components

### 6.1 Flavor chip

Name plus dimension summary. Left border 3px in `--flavor-*`, otherwise neutral.
Never a solid flavor-colored fill behind text, which would fail contrast at these
steps and cannot be reliably printed.

### 6.2 Dimension row

`Sec Hi · Acct Hi · Eff Lo · Innov Lo` rendered as four chips per section 2.3, with a
visually hidden expansion for screen readers: "Security: High. Accountability: High.
Efficiency: Low. Innovation: Low."

### 6.3 Risk callout

`role="note"` with an `aria-label`. Left border 4px `--flavor-red`, background
`--surface-sunken`, warning glyph inlined as SVG (not an icon font, not an external
sprite). Heading is the word "Risk" plus the callout title, so the meaning survives
grayscale.

### 6.4 Diff highlight

Changed passage gets `--surface-raised` background, a 3px left border in the flavor
being compared to, and a visually hidden "changed:" prefix. Unchanged sections
collapse behind a `<details>` element, which needs no JavaScript.

### 6.5 PDF download

Present on every job, flavor, and compare page. Plain link to a relative `pdf/*.pdf`
path with the file size in the label. Not a button, not a JS-triggered download, both
of which break under `file://`.

## 7. Print and PDF

The print stylesheet is a deliverable, not an afterthought; it produces the 21 PDFs.

- Force the light token set. Dark backgrounds waste toner and the PDFs are neutral
  documents.
- Use the pinned print font stack from section 5.1, never the screen stack. A PDF
  built on a developer Mac and one built in CI must be byte-comparable.
- Hide all three tab rows, the PDF download link, and any interactive control.
- Flavor color survives as the left border and the flavor name; body text prints
  black regardless of theme.
- `break-inside: avoid` on risk callouts and dimension rows; `break-before: page`
  between flavors in the comparison packets.
- Provenance footer comes from Playwright's `footerTemplate`, not CSS, per
  TOOLING-AND-DEPLOYMENT.md section 6.3.
- Target a readable 11pt body at A4 and US Letter both.

## 8. Accessibility checklist

Gate for release, mapping to spec section 8 and success criterion 6.

- [ ] All text meets AA 4.5:1; all UI components and graphics meet 3:1
- [ ] No information conveyed by color alone (1.4.1)
- [ ] Tabs are links with `aria-current="page"`, not `role="tab"`
- [ ] Every nav landmark has an `aria-label` distinguishing the three rows
- [ ] Visible focus indicator, 2px `--text-strong`, 2px offset, on every interactive element
- [ ] Logical heading hierarchy, one `h1` per page, no skipped levels
- [ ] Site fully operable and readable with JavaScript disabled
- [ ] Site fully operable at 320px width and at 200% zoom without horizontal scroll
- [ ] `prefers-reduced-motion` honored; there is no essential animation
- [ ] Verified in a screen reader, not only by automated tooling
