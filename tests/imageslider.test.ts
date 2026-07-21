import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createSlider, HEIGHT, OFFSET, WIDTH } from './helpers/slider.ts';

/** Arrow keys move the slider by 2% per press. */
const STEP_PERCENT = 2;

describe('initialisation', () => {
    it('wraps each image in its own clip container', async () => {
        const s = await createSlider();
        assert.equal(s.clipContainers(), 2);
        assert.ok(s.wrapper.querySelector('.mw-imageslider-before > img.before'));
        assert.ok(s.wrapper.querySelector('.mw-imageslider-after > img.after'));
    });

    it('starts centred', async () => {
        const s = await createSlider();
        assert.equal(s.reveal(), WIDTH / 2);
        assert.equal(s.valueNow(), 50);
    });

    it('sizes the wrapper from the after image aspect ratio', async () => {
        // 1000x250 over a 900px-wide wrapper => 225px tall.
        const s = await createSlider({ naturalWidth: 1000, naturalHeight: 250 });
        assert.equal(s.wrapper.style.height, '225px');
    });

    it('does not re-initialise when the content hook fires twice', async () => {
        const s = await createSlider({ mediaWiki: true });
        s.fireHook('wikipage.content');
        s.fireHook('wikipage.content');
        assert.equal(s.clipContainers(), 2, 'images must not be double-wrapped');
    });

    it('bails out when the images are missing', async () => {
        const s = await createSlider({ withImages: false });
        assert.equal(s.clipContainers(), 0);
        assert.ok(Number.isNaN(s.reveal()), 'no reveal should be published');
    });

    it('bails out when the handle is missing', async () => {
        const s = await createSlider({ withHandle: false });
        assert.equal(s.clipContainers(), 0);
    });
});

describe('keyboard, vertical orientation', () => {
    it('moves right/up forwards and left/down backwards', async () => {
        for (const [key, delta] of [
            ['ArrowRight', +STEP_PERCENT],
            ['ArrowUp', +STEP_PERCENT],
            ['ArrowLeft', -STEP_PERCENT],
            ['ArrowDown', -STEP_PERCENT]
        ] as const) {
            const s = await createSlider();
            assert.equal(s.press(key), true, `${key} should be handled`);
            assert.equal(s.valueNow(), 50 + delta, `${key}`);
        }
    });

    it('jumps to the ends with Home and End', async () => {
        const s = await createSlider();

        s.press('Home');
        assert.equal(s.valueNow(), 0);
        assert.equal(s.reveal(), 0);

        s.press('End');
        assert.equal(s.valueNow(), 100);
        assert.equal(s.reveal(), WIDTH);
    });

    it('clamps at both ends', async () => {
        const s = await createSlider();

        s.press('Home');
        s.press('ArrowLeft');
        assert.equal(s.valueNow(), 0, 'must not go below 0');

        s.press('End');
        s.press('ArrowRight');
        assert.equal(s.valueNow(), 100, 'must not go above 100');
    });

    it('ignores unrelated keys without swallowing them', async () => {
        const s = await createSlider();
        assert.equal(s.press('PageUp'), false, 'default must not be prevented');
        assert.equal(s.valueNow(), 50);
    });

    it('positions the handle horizontally', async () => {
        const s = await createSlider();
        assert.equal(s.handle.style.left, WIDTH / 2 + 'px');
        assert.equal(s.handle.style.top, '');
    });
});

describe('keyboard, horizontal orientation', () => {
    it('inverts the arrow-key mapping', async () => {
        for (const [key, delta] of [
            ['ArrowDown', +STEP_PERCENT],
            ['ArrowRight', +STEP_PERCENT],
            ['ArrowUp', -STEP_PERCENT],
            ['ArrowLeft', -STEP_PERCENT]
        ] as const) {
            const s = await createSlider({ orientation: 'horizontal' });
            assert.equal(s.press(key), true, `${key} should be handled`);
            assert.equal(s.valueNow(), 50 + delta, `${key}`);
        }
    });

    it('reveals along the height and positions the handle vertically', async () => {
        const s = await createSlider({ orientation: 'horizontal' });
        assert.equal(s.reveal(), HEIGHT / 2);
        assert.equal(s.handle.style.top, HEIGHT / 2 + 'px');
        assert.equal(s.handle.style.left, '');
    });
});

describe('pointer interaction', () => {
    it('jumps to a click on the wrapper', async () => {
        const s = await createSlider();
        s.clickAt(OFFSET.left + 675, OFFSET.top + 150);
        assert.equal(s.valueNow(), 75);
        assert.equal(s.reveal(), 675);
    });

    it('uses the vertical axis for a click in horizontal mode', async () => {
        const s = await createSlider({ orientation: 'horizontal' });
        s.clickAt(OFFSET.left + 675, OFFSET.top + 150);
        assert.equal(s.valueNow(), 25, 'position should follow pageY, not pageX');
    });

    it('does not jump when the click lands on the handle', async () => {
        const s = await createSlider();
        s.clickHandle();
        assert.equal(s.valueNow(), 50);
    });

    it('clamps a click outside the wrapper', async () => {
        const s = await createSlider();
        s.clickAt(OFFSET.left - 500, OFFSET.top);
        assert.equal(s.valueNow(), 0);
        s.clickAt(OFFSET.left + WIDTH + 500, OFFSET.top);
        assert.equal(s.valueNow(), 100);
    });

    it('tracks the mouse while dragging', async () => {
        const s = await createSlider();
        assert.equal(s.startDrag(), true, 'mousedown must preventDefault to stop image dragging');

        s.moveMouse(OFFSET.left + 225, OFFSET.top);
        assert.equal(s.valueNow(), 25);

        s.moveMouse(OFFSET.left + 810, OFFSET.top);
        assert.equal(s.valueNow(), 90);
    });

    it('tracks touch moves', async () => {
        const s = await createSlider();
        s.startDrag();
        s.moveTouch(OFFSET.left + 450 + 225, OFFSET.top);
        assert.equal(s.valueNow(), 75);
    });

    it('stops tracking after the drag ends', async () => {
        const s = await createSlider();
        s.startDrag();
        s.moveMouse(OFFSET.left + 225, OFFSET.top);
        assert.equal(s.valueNow(), 25);

        s.endDrag();
        s.moveMouse(OFFSET.left + WIDTH, OFFSET.top);
        assert.equal(s.valueNow(), 25, 'position must not follow the mouse after mouseup');
    });

    it('does not move before a drag has started', async () => {
        const s = await createSlider();
        s.moveMouse(OFFSET.left + WIDTH, OFFSET.top);
        assert.equal(s.valueNow(), 50);
    });
});

describe('layout', () => {
    it('recomputes on window resize', async () => {
        const s = await createSlider();
        s.press('End');
        s.wrapper.style.removeProperty('--imageslider-reveal');

        s.resize();
        assert.equal(s.reveal(), WIDTH, 'resize should republish the reveal for the current position');
    });
});

describe('MediaWiki integration', () => {
    it('defers to the wikipage.content hook when mw is present', async () => {
        const s = await createSlider({ mediaWiki: true });
        assert.deepEqual(s.hookNames(), ['wikipage.content']);
        assert.equal(s.clipContainers(), 0, 'should wait for the hook rather than self-starting');

        s.fireHook('wikipage.content');
        assert.equal(s.clipContainers(), 2);
    });

    it('falls back to jQuery ready outside MediaWiki', async () => {
        const s = await createSlider();
        assert.equal(s.clipContainers(), 2);
    });
});
