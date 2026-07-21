/// <reference types="jquery" />
/// <reference types="oojs-ui" />
/// <reference types="types-mediawiki" />

/**
 * ResourceLoader exposes `mw` (alias `mediaWiki`) as a global, but imageslider.ts
 * probes it through `window` so the check cannot throw when the script is loaded
 * outside MediaWiki.
 */
interface Window {
    mediaWiki?: typeof mediaWiki;
}
