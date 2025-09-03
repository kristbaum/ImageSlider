# ImageSlider

MediaWiki extension providing a lightweight before/after image comparison slider via a parser function.

## Features

* Simple, dependency‑light slider (pure JS + CSS; no external network requests)
* Parser function: `{{#imageslider:Image1=File:Before.jpg|Image2=File:After.jpg|width=900px}}`
* Keyboard accessible (arrow keys / Home / End)
* Works on desktop & mobile (pointer + touch)
* Development environment with Docker Compose

## Installation (manual)

1. Clone into your `extensions` directory:

```bash
cd /path/to/mediawiki/extensions
git clone https://example.org/ImageSlider.git ImageSlider
```

1. Add to `LocalSettings.php`:

```php
wfLoadExtension( 'ImageSlider' );
```
1. Clear caches (optional): `php maintenance/run.php purgeList --list=Main_Page` or touch `LocalSettings.php`.

Requires MediaWiki 1.35+ (tested with 1.44 in dev setup).

## Usage

Upload (or already have) two files on the wiki. Then add to a page:

```wikitext
{{#imageslider:Image1=File:OldTown_square_1900.jpg|Image2=File:OldTown_square_2024.jpg|width=900px}}
```

Parameters:

* `Image1` (required) – First image (left side initially visible)
* `Image2` (required) – Second image (revealed when sliding)
* `width` (optional) – Max container width (e.g. `900px`, `600px`, `100%`). Defaults to auto (full width of parent).

If an image can't be resolved an inline error plus tracking category is added.

### Accessibility & Interaction

* Drag the circular handle horizontally to reveal more / less.
* Keyboard: Left / Right (or Up / Down) adjusts; Home = 0%, End = 100%.

## Development Environment (Docker)

Spin up a fresh MediaWiki + MariaDB with the extension mounted.

```bash
docker compose up -d --build
```

Access: <http://localhost:8080>

An admin user & database are auto‑provisioned via environment variables defined in `docker-compose.yml` (admin / adminpass for quick local testing – do **not** reuse in production).

To stop:

```bash
docker compose down
```

Persistent volumes retain uploaded images & database data (`images`, `dbdata`). Remove with:

```bash
docker compose down -v
```

### Making Code Changes

Resources are loaded through ResourceLoader. After editing JS/CSS you may need to bypass cache:

* Append `?action=purge` to the page OR
* Use browser hard reload (Ctrl+F5)

### Adding Sample Images

1. Log in as admin
2. Upload two images (`Special:Upload`)
3. Edit `Main Page` and insert the parser function.

## Architecture Notes

* `extension.json` registers a parser hook (`#imageslider`) and a single RL module `ext.ImageSlider`.
* The hook resolves File: titles to URLs via core RepoGroup service.
* JavaScript wraps the first image in a clipping container; the handle adjusts width via inline styles.
* No external third‑party library bundled (original Twentytwenty design concept re‑implemented from scratch to avoid extra payload & licensing concerns). Feel free to swap in another implementation inside `resources/js/imageslider.js` if needed.

## Internationalisation

Messages are in `i18n/en.json`. Provide translations by adding new language JSON files (e.g. `i18n/de.json`) with the same keys.

## Tracking Category

Pages misusing the function (missing params or missing files) are added to the category exposed via message: `imageslider-tracking-category`.

## Template Wrapper (Optional)

You can create a template `Template:ImageSlider` replicating the historic usage:

```wikitext
<noinclude>{{Documentation}}</noinclude>
<includeonly>{{#imageslider:Image1={{{Image1|}}}|Image2={{{Image2|}}}|width={{{width|auto}}}}}</includeonly>
```

Then invoke:

```wikitext
{{ImageSlider|Image1=File:A.jpg|Image2=File:B.jpg|width=600px}}
```

## Roadmap / Ideas

* Vertical mode (optional parameter `mode=vertical`)
* Lazy loading via `loading="lazy"` & intersection observer
* Optional labels (e.g. `label1=Then|label2=Now`)
* Add QUnit test module
* RTL layout testing
