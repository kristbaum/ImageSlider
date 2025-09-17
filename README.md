# ImageSlider

Lightweight before/after comparison slider for MediaWiki pages (pure JS + CSS, no external dependencies).

## 1. Overview

ImageSlider provides a parser function that overlays two images with a draggable handle (or keyboard‑controlled slider) to reveal differences. Supports vertical (left/right) and horizontal (up/down) orientations, is accessible, and ships with a turnkey Docker environment.

## 2. Features

* Parser function: `{{#imageslider:Image1=File:Before.jpg|Image2=File:After.jpg|width=900px}}`
* Vertical & horizontal orientations (`orientation=vertical|horizontal`)
* Keyboard & screen‑reader friendly (ARIA slider semantics)
* Works with mouse, touch, and keyboard
* Automatic aspect‑ratio preservation based on first image
* Error reporting + tracking category for missing/misused parameters
* Self‑contained ResourceLoader module (single JS + CSS bundle)

## 3. Requirements

* MediaWiki 1.39+ (developed & tested with 1.44 dev)
* PHP & extensions per your MediaWiki core version
* For Docker dev environment: Docker + Docker Compose v2

## 4. Installation

Clone into `extensions` and enable:

```bash
cd /path/to/mediawiki/extensions
git clone https://example.org/ImageSlider.git ImageSlider
```

Add to `LocalSettings.php`:

```php
wfLoadExtension( 'ImageSlider' );
```

Optionally purge a page or touch `LocalSettings.php` to bypass caches.

## 5. Usage

Place the parser function on any wiki page after ensuring both files exist:

```wikitext
{{#imageslider:Image1=File:20250528 SL1 Offiziers Speiseanstalt, Postkarte.jpg|Image2=File:20250528 SL2 Offiziers Speiseanstalt Fürth.jpg|width=900px|orientation=vertical}}
```

### Parameters

| Name | Required | Description |
|------|----------|-------------|
| `Image1` | yes | First image; initially visible side (left or top). |
| `Image2` | yes | Second image; revealed as you slide. |
| `width` | no  | Max container width (e.g. `900px`, `60%`, `100%`). Defaults to full available width. |
| `orientation` | no | `vertical` (default, divider left/right) or `horizontal` (divider up/down). |

If a file can't be resolved an inline error message is shown and the page is added to the tracking category.

### Interaction & Accessibility

* Drag the circular handle (pointer or touch)
* Click/tap anywhere on the image to jump the handle
* Keyboard: Arrow keys adjust (±2%), Home = 0%, End = 100%
* ARIA role="slider" with orientation & value states provided

## 6. Development (Docker)

The dev environment now uses SQLite (file-based) instead of a separate MariaDB container to keep setup friction minimal.

### Start MediaWiki + Extension

```bash
docker compose up -d --build
```

Then visit <http://localhost:8080>.

Remove all persistent data (images + SQLite DB) and rebuild fresh:

```bash
docker compose down -v
```

## 7. Architecture

* `extension.json` registers the parser hook and ResourceLoader module `ext.ImageSlider`.
* Parser hook resolves `File:` titles to URLs using MediaWiki core services (RepoGroup).
* A wrapper holds two absolutely positioned images; the top image is clipped via a CSS `clip-path` updated by JS.
* JS keeps a CSS custom property (`--imageslider-reveal`) in pixels for precise clipping.
* Handle position & accessibility state (aria-valuenow) update with input.
* Orientation toggles axis math (x vs y) without duplicate code paths.

## 8. Tracking Category

Pages with configuration errors (missing images/params) are put in the category referenced by message key: `imageslider-tracking-category`.

## 9. Optional Template Wrapper (with captions & file links)

Create `Template:ImageSlider` to simplify usage and add caption lines linking to the file description pages.

```wikitext
<includeonly>
<!-- Core slider -->
{{#imageslider:Image1={{{Image1|}}}|Image2={{{Image2|}}}|width={{{width|}}}|orientation={{{orientation|vertical}}}}}

<!-- Caption block (shows only if at least one caption provided) -->
<div class="imageslider-captions" style="margin-top:0.4em; font-size:90%; line-height:1.4;">
[[:File:{{PAGENAME:{{{Image1|}}}}}|First image]]: {{{Caption1|}}}

[[:File:{{PAGENAME:{{{Image2|}}}}}|Second image]]: {{{Caption2|}}}
</div>
</includeonly><noinclude>
This template wraps the ImageSlider parser function.

Parameters:
* Image1 / Image2 (required): File titles (include the `File:` prefix)
* width (optional, pixels)
* orientation (vertical|horizontal, default vertical)
* Caption1 / Caption2 (optional): Text shown beneath with a link to each file.

Example usage:
<pre>{{ImageSlider
 | Image1 = File:20250528 SL1 Offiziers Speiseanstalt, Postkarte.jpg
 | Image2 = File:20250528 SL2 Offiziers Speiseanstalt Fürth.jpg
 | width = 900px
 | orientation = vertical
 | Caption1 = Postcard, ca. 1916
 | Caption2 = Photo from May 2025
}}</pre>
</noinclude>
```
