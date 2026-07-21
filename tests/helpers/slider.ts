/**
 * Test harness: builds a jsdom page carrying the exact markup Hooks.php emits,
 * loads jQuery and the *built* resources/js/imageslider.js into it, and exposes
 * helpers for driving the slider.
 *
 * The tests deliberately exercise the compiled artifact rather than the
 * TypeScript source, because that file is what ResourceLoader ships.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, type DOMWindow } from 'jsdom';

/** Geometry the layout stubs report, since jsdom has no layout engine. */
export const WIDTH = 900;
export const HEIGHT = 600;
export const OFFSET = { top: 100, left: 50 };

/** npm scripts always run from the package root. */
const root = process.cwd();
const BUILT_SCRIPT = join(root, 'resources/js/imageslider.js');
const JQUERY = join(root, 'node_modules/jquery/dist/jquery.js');

export type Orientation = 'vertical' | 'horizontal';

export interface SliderOptions {
    orientation?: Orientation;
    /** Drop the <img> elements to exercise the bail-out path. */
    withImages?: boolean;
    /** Drop the handle to exercise the bail-out path. */
    withHandle?: boolean;
    /** Expose a fake `mw` so the script registers on wikipage.content. */
    mediaWiki?: boolean;
    naturalWidth?: number;
    naturalHeight?: number;
}

export interface Slider {
    window: DOMWindow;
    wrapper: HTMLElement;
    handle: HTMLElement;
    /** Current `--imageslider-reveal`, in px, as a number. */
    reveal(): number;
    valueNow(): number;
    /** Elements the script inserts to clip each image. */
    clipContainers(): number;
    /** Dispatch a keydown on the handle; returns whether the default was prevented. */
    press(key: string): boolean;
    clickAt(pageX: number, pageY: number): void;
    clickHandle(): void;
    /** mousedown on the handle; returns whether the default was prevented. */
    startDrag(): boolean;
    moveMouse(pageX: number, pageY: number): void;
    moveTouch(pageX: number, pageY: number): void;
    endDrag(): void;
    resize(): void;
    /** Fire a MediaWiki hook (only meaningful with `mediaWiki: true`). */
    fireHook(name: string): void;
    hookNames(): string[];
}

function markup(o: Required<Pick<SliderOptions, 'orientation'>> & SliderOptions): string {
    const images = o.withImages === false
        ? ''
        : '<img alt="" width="900" class="mw-imageslider-img before" src="before.jpg">' +
          '<img alt="" width="900" class="mw-imageslider-img after" src="after.jpg">';
    const handle = o.withHandle === false
        ? ''
        : `<div class="mw-imageslider-handle" role="slider" tabindex="0" aria-label="Drag to compare"
             aria-orientation="${o.orientation}" aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="50"><span class="mw-imageslider-grip"></span></div>`;

    return `<!doctype html><html><body>
<div class="mw-imageslider mw-imageslider-${o.orientation}" style="width:900px" data-orientation="${o.orientation}">
  <div class="mw-imageslider-wrapper" data-width="900px">${images}${handle}</div>
</div></body></html>`;
}

/**
 * Wait until jQuery's ready callbacks have run. jQuery schedules them with the
 * page's own setTimeout, so draining a page timer afterwards guarantees they
 * have fired.
 */
async function flushReady(window: DOMWindow): Promise<void> {
    if (window.document.readyState !== 'complete') {
        await new Promise<void>((resolve) => {
            window.addEventListener('load', () => resolve(), { once: true });
        });
    }
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
}

export async function createSlider(options: SliderOptions = {}): Promise<Slider> {
    const opts = { orientation: 'vertical' as Orientation, ...options };

    const dom = new JSDOM(markup(opts), { runScripts: 'outside-only', pretendToBeVisual: true });
    const window = dom.window;

    // Load jQuery into the page the same way ResourceLoader would.
    window.eval(readFileSync(JQUERY, 'utf8'));
    const jq = window.jQuery;

    // jsdom reports every box as 0x0, so stub the geometry the script reads.
    // height() is per-element and honours a previously set inline height, so the
    // aspect-ratio sizing done by layout() stays observable.
    jq.fn.width = function (this: JQueryLike, v?: number) {
        if (v === undefined) { return WIDTH; }
        return this;
    };
    jq.fn.height = function (this: JQueryLike, v?: number) {
        if (v === undefined) {
            const styled = this[0]?.style?.height;
            return styled ? parseFloat(styled) : HEIGHT;
        }
        this.css('height', v + 'px');
        return this;
    };
    jq.fn.offset = function () { return { ...OFFSET }; };

    for (const img of Array.from(window.document.querySelectorAll('img'))) {
        Object.defineProperty(img, 'naturalWidth', { value: opts.naturalWidth ?? 1200 });
        Object.defineProperty(img, 'naturalHeight', { value: opts.naturalHeight ?? 800 });
        Object.defineProperty(img, 'complete', { value: true });
    }

    const hooks = new Map<string, Array<(...args: unknown[]) => void>>();
    if (opts.mediaWiki) {
        const mw = {
            hook(name: string) {
                return {
                    add(fn: (...args: unknown[]) => void) {
                        const list = hooks.get(name) ?? [];
                        list.push(fn);
                        hooks.set(name, list);
                    }
                };
            }
        };
        window.mw = mw;
        window.mediaWiki = mw;
    }

    window.eval(readFileSync(BUILT_SCRIPT, 'utf8'));
    // Without mw present the script defers to jQuery's ready queue, which resolves
    // only once the document has finished loading.
    await flushReady(window);

    const wrapper = window.document.querySelector('.mw-imageslider-wrapper') as HTMLElement;
    const handle = window.document.querySelector('.mw-imageslider-handle') as HTMLElement;

    const withPage = <T extends Event>(event: T, pageX: number, pageY: number): T => {
        Object.defineProperty(event, 'pageX', { value: pageX });
        Object.defineProperty(event, 'pageY', { value: pageY });
        return event;
    };

    return {
        window,
        wrapper,
        handle,
        reveal: () => parseFloat(wrapper.style.getPropertyValue('--imageslider-reveal')),
        valueNow: () => Number(handle.getAttribute('aria-valuenow')),
        clipContainers: () =>
            wrapper.querySelectorAll('.mw-imageslider-before, .mw-imageslider-after').length,

        press(key) {
            const ev = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            handle.dispatchEvent(ev);
            return ev.defaultPrevented;
        },
        clickAt(pageX, pageY) {
            wrapper.dispatchEvent(
                withPage(new window.MouseEvent('click', { bubbles: true, cancelable: true }), pageX, pageY)
            );
        },
        clickHandle() {
            handle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
        },
        startDrag() {
            const ev = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
            handle.dispatchEvent(ev);
            return ev.defaultPrevented;
        },
        moveMouse(pageX, pageY) {
            window.document.dispatchEvent(
                withPage(new window.MouseEvent('mousemove', { bubbles: true }), pageX, pageY)
            );
        },
        moveTouch(pageX, pageY) {
            // jsdom has no TouchEvent constructor; the script only reads `touches`.
            const ev = new window.Event('touchmove', { bubbles: true });
            Object.defineProperty(ev, 'touches', { value: [{ pageX, pageY }] });
            window.document.dispatchEvent(ev);
        },
        endDrag() {
            window.document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
        },
        resize() {
            window.jQuery(window).trigger('resize');
        },
        fireHook(name) {
            for (const fn of hooks.get(name) ?? []) { fn(); }
        },
        hookNames: () => Array.from(hooks.keys())
    };
}

/** Minimal shape of the jQuery collection the stubs above operate on. */
interface JQueryLike {
    [index: number]: HTMLElement | undefined;
    css(name: string, value: string): JQueryLike;
}
