# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`ImageSlider` is a **MediaWiki extension** (not a standalone web app). It adds a
`{{#imageslider:}}` parser function that renders a before/after image comparison
slider with vertical (left/right) or horizontal (up/down) reveal.

Usage on a wiki page:

```wikitext
{{#imageslider:Image1=File:Example1.jpg|Image2=File:Example2.jpg|width=900px|orientation=vertical}}
```

## Architecture

Three layers, each owning one part of the feature:

| Layer | File | Role |
| --- | --- | --- |
| PHP | [includes/Hooks.php](includes/Hooks.php) | Resolves the two `File:` titles to thumbnail URLs and emits the slider markup. Runs at parse time. |
| TypeScript | [src/imageslider.ts](src/imageslider.ts) | Wires up drag / click / keyboard interaction in the browser. |
| CSS | [resources/css/imageslider.css](resources/css/imageslider.css) | Clipping, handle, and grip visuals, driven by custom properties. |

The PHP and the client code are coupled only through the DOM contract: class
names (`mw-imageslider`, `mw-imageslider-wrapper`, `img.before`, `img.after`,
`mw-imageslider-handle`), the `data-orientation` attribute, and the ARIA slider
attributes. **Change one side and you must change the other.**

The reveal position is communicated to CSS through the
`--imageslider-reveal` custom property, which the JS sets in pixels on the
wrapper; CSS turns it into a `clip-path` inset.

## The build step — read this before touching any JS

`resources/js/imageslider.js` is **generated output and is committed on
purpose**. MediaWiki's ResourceLoader serves that file straight from disk and
has no build step of its own, so the compiled artifact has to be in the repo.

- **Edit [src/imageslider.ts](src/imageslider.ts). Never edit `resources/js/imageslider.js` by hand** —
  the next `npm run build` will silently discard your changes.
- After changing the TypeScript, **always run `npm run build` and commit the
  regenerated JS in the same commit.** A commit that changes the `.ts` without the
  `.js` ships nothing to users.

```bash
npm install       # once
npm run build     # src/*.ts -> resources/js/*.js
npm run watch     # rebuild on save
npm run lint      # type-check only, no emit
```

### tsconfig notes

Two settings are deliberate and load-bearing; don't "clean them up":

- `"module": "preserve"` — ResourceLoader needs a plain script, not an ES or
  CommonJS module. `preserve` emits `imageslider.ts` unchanged as a script
  (it has no top-level `import`/`export`) while still giving modern
  `node_modules` type resolution. `"module": "none"` would fall back to classic
  resolution and fail to find the type packages.
- `"types": []` plus explicit `/// <reference types="..." />` lines in
  [src/types/globals.d.ts](src/types/globals.d.ts) — nothing is auto-included, so the global surface
  (`$`, `mw`, `OO`) is declared in exactly one place.

`$` and `mw` are **globals supplied by ResourceLoader at runtime**, typed via
`@types/jquery` and `types-mediawiki`. Do not `import` them; there is no bundler.

## Local development wiki

```bash
docker compose up -d      # MediaWiki 1.44 + SQLite on http://localhost:8080
```

The repo is bind-mounted to `extensions/ImageSlider` and loaded by
[docker/LocalSettings.php](docker/LocalSettings.php). Uploads are off and InstantCommons is on, so test
with real Commons files (e.g. `File:Example.jpg`).

After editing CSS or JS you usually need a hard reload; ResourceLoader caches
aggressively. Appending `?action=purge` to the page, or `?debug=true` to the
URL, helps.

## Conventions

- **Indentation is 4 spaces** in PHP, TypeScript, and CSS. This repo does *not*
  follow the MediaWiki core tabs-and-spaced-parens style — match what is already
  in the file.
- PHP is `declare(strict_types=1)`, namespace `ImageSlider\`, autoloaded from
  `includes/`.
- **Any user-facing string must be an i18n message**, never a literal. Add the
  key to *both* [i18n/en.json](i18n/en.json) (the English text) and [i18n/qqq.json](i18n/qqq.json) (a
  description for translators). Missing `qqq.json` entries are treated as a bug
  upstream.
- Errors surfaced to readers should go through `Hooks::errorOutput()`, which
  also adds the page to the `imageslider-tracking-category` tracking category.
- The parser function accepts only pixel widths; percentages fall back to the
  default. Widths are clamped to `MAX_THUMB_WIDTH` so the wiki is never asked to
  render an enormous thumbnail.

## Accessibility

The handle is a real ARIA slider (`role="slider"`, `tabindex="0"`,
`aria-valuemin/max/now`, `aria-orientation`). Arrow keys move it by `STEP`
(2%), and Home/End jump to the ends. `aria-valuenow` is kept in sync in
`layout()`. **Preserve this when refactoring** — it is a stated feature of the
extension, and the arrow-key mapping intentionally differs between the two
orientations.

## Testing

```bash
npm test        # builds, then runs the suite
npm run lint    # type-checks src/ and tests/
```

[tests/imageslider.test.ts](tests/imageslider.test.ts) covers the client behaviour: initialisation and
its bail-out paths, the double-init guard, arrow/Home/End keys in both
orientations, clamping, click-to-jump, mouse and touch dragging, drag teardown,
resize, and the `wikipage.content` wiring.

The runner is Node's built-in `node --test`; the tests are TypeScript executed
directly via Node's type stripping, so **they are never compiled and must not be
added to the main `tsconfig.json`** — that would emit them into `resources/js/`.
[tsconfig.test.json](tsconfig.test.json) type-checks them with `noEmit`.

Two properties of the setup are worth knowing before you change it:

- **The tests load the built `resources/js/imageslider.js`, not the TypeScript
  source**, because that artifact is what ResourceLoader ships. `npm test` runs
  `npm run build` first via `pretest`; if you run `node --test` directly you are
  testing whatever was last built.
- **jsdom has no layout engine**, so [tests/helpers/slider.ts](tests/helpers/slider.ts) stubs
  `width()`, `height()` and `offset()`. Anything that depends on real layout —
  most obviously resize behaviour with a genuinely changing viewport — is *not*
  covered and still needs a browser check.

jQuery is pinned to 3.x to match what MediaWiki 1.44 ships. Don't let it drift
to 4.x; the tests would then be exercising a jQuery the extension never runs
against.

There are **no PHP tests**. [includes/Hooks.php](includes/Hooks.php) needs a full MediaWiki install to
exercise, so verify parser-function changes by hand in the Docker wiki: both
orientations, a missing/unknown file, and a non-pixel width.

## Gotchas

- `initSlider` guards on a `imageslider-init` data flag because
  `mw.hook('wikipage.content')` can fire more than once (e.g. after a
  VisualEditor save). Keep the guard, or images get double-wrapped.
- Drag handlers are bound to `document` under the `.imageslider` event
  namespace and removed wholesale on `mouseup`/`touchend`. Reuse the namespace
  for any new document-level handler so teardown stays correct.
- `layout()` sets the wrapper's height from the *after* image's natural aspect
  ratio, because the images are absolutely positioned and would otherwise
  collapse the container.
