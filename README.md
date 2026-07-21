# ImageSlider

The ImageSlider extension provides a simple, dependency‑light before/after comparison slider for two images using a parser function.

It supports both vertical (left/right) and horizontal (up/down) reveal modes, is keyboard accessible (ARIA slider, arrow keys, Home/End), touch/mouse friendly, and adds no external libraries.

Based on the FürthWiki implementation by Mark Muzenhardt. 

See the full documentation on [mediawiki.org](https://www.mediawiki.org/wiki/Extension:ImageSlider).

## Development

The client-side code is written in TypeScript under `src/`. ResourceLoader serves
plain JavaScript, so `resources/js/imageslider.js` is compiled output that is
committed to the repository — edit `src/imageslider.ts`, never the generated file.

```bash
npm install
npm run build   # compile src/ -> resources/js/
npm run watch   # rebuild on save
npm test        # build, then run the jsdom test suite
npm run lint    # type-check src/ and tests/

docker compose up -d   # dev wiki on http://localhost:8080
```

See [AGENTS.md](AGENTS.md) for a fuller description of the layout and conventions.

![Video of the Extension](https://upload.wikimedia.org/wikipedia/commons/2/28/ImageSliderExtensionDemo.gif)
