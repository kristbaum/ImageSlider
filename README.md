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

* MediaWiki 1.35+ (developed & tested with 1.44 dev)
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
{{#imageslider:Image1=File:OldTown_square_1900.jpg|Image2=File:OldTown_square_2024.jpg|width=900px|orientation=vertical}}
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

Local environment with MediaWiki + MariaDB:

```bash
docker compose up -d --build
```

Visit <http://localhost:8080> and log in with the credentials from `docker-compose.yml` (default: admin / adminpass111 — do NOT reuse in production).

Stop containers:

```bash
docker compose down
```

Remove volumes (wipe images & DB):

```bash
docker compose down -v
```

### Cache Busting During Development

* Add `?action=purge` to the page URL, or
* Force reload (Ctrl+F5)

### Adding Sample Images

1. Upload two images via `Special:Upload`
2. Edit a page and insert the parser function
3. Adjust `width=` or `orientation=` as needed

## 7. Architecture

* `extension.json` registers the parser hook and ResourceLoader module `ext.ImageSlider`.
* Parser hook resolves `File:` titles to URLs using MediaWiki core services (RepoGroup).
* A wrapper holds two absolutely positioned images; the top image is clipped via a CSS `clip-path` updated by JS.
* JS keeps a CSS custom property (`--imageslider-reveal`) in pixels for precise clipping.
* Handle position & accessibility state (aria-valuenow) update with input.
* Orientation toggles axis math (x vs y) without duplicate code paths.

## 8. Internationalisation

Translations live in `i18n/*.json`. Add a new language file (e.g. `i18n/de.json`) mirroring keys in `en.json`.

## 9. Tracking Category

Pages with configuration errors (missing images/params) are put in the category referenced by message key: `imageslider-tracking-category`.

## 10. Optional Template Wrapper

Create `Template:ImageSlider` for friendlier syntax:

```wikitext
<includeonly>{{#imageslider:Image1={{{Image1|}}}|Image2={{{Image2|}}}|width={{{width|auto}}}|orientation={{{orientation|vertical}}}}}</includeonly><noinclude>Documentation here</noinclude>
```

Invoke:

```wikitext
{{ImageSlider|Image1=File:A.jpg|Image2=File:B.jpg|width=600px|orientation=horizontal}}
```
