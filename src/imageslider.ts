/**
 * ImageSlider — before/after image comparison slider.
 *
 * This is the source of truth. `npm run build` compiles it to
 * resources/js/imageslider.js, which is the file ResourceLoader ships
 * (see extension.json). Do not edit the emitted JS by hand.
 */
(function () {
    /** Fraction of the track traversed per arrow key press. */
    const STEP = 0.02;

    type Orientation = 'vertical' | 'horizontal';

    interface Point {
        pageX: number;
        pageY: number;
    }

    function clamp(v: number): number { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    /** Page coordinates of a mouse event, or of the first touch point of a touch event. */
    function pointOf(ev: JQuery.TriggeredEvent): Point {
        const original = ev.originalEvent;
        if (original && 'touches' in original) {
            const touch = (original as TouchEvent).touches[0];
            if (touch) { return touch; }
        }
        return { pageX: ev.pageX || 0, pageY: ev.pageY || 0 };
    }

    function initSlider($wrapper: JQuery): void {
        if ($wrapper.data('imageslider-init')) { return; }
        $wrapper.data('imageslider-init', true);

        const $before = $wrapper.find('img.before') as JQuery<HTMLImageElement>;
        const $after = $wrapper.find('img.after') as JQuery<HTMLImageElement>;
        const $handle = $wrapper.find('.mw-imageslider-handle');
        // The parser function only ever emits 'vertical' or 'horizontal'.
        const orientation: Orientation =
            $wrapper.closest('.mw-imageslider').data('orientation') === 'horizontal' ? 'horizontal' : 'vertical';
        if (!$before.length || !$after.length || !$handle.length) { return; }

        // Wrap images (clip containers)
        $before.wrap('<div class="mw-imageslider-before"></div>');
        $after.wrap('<div class="mw-imageslider-after"></div>');

        let position = 0.5; // 50%

        function layout(): void {
            // Maintain aspect ratio of first image
            const w = $wrapper.width() || 0;
            const natW = $after[0].naturalWidth || w;
            const natH = $after[0].naturalHeight || $after.height() || 0;
            if (natW && natH) {
                $wrapper.height(Math.round((natH / natW) * w));
            }
            const track = orientation === 'horizontal' ? ($wrapper.height() || 0) : w;
            const revealPx = Math.round(track * position);
            $wrapper[0].style.setProperty('--imageslider-reveal', revealPx + 'px');
            if (orientation === 'horizontal') {
                $handle.css({ top: revealPx + 'px', left: '' });
            } else {
                $handle.css({ left: revealPx + 'px', top: '' });
            }
            $handle.attr('aria-valuenow', Math.round(position * 100));
        }

        function pointerToPosition(pageX: number, pageY: number): void {
            const off = $wrapper.offset();
            if (!off) { return; }
            if (orientation === 'horizontal') {
                position = clamp((pageY - off.top) / ($wrapper.height() || 1));
            } else {
                position = clamp((pageX - off.left) / ($wrapper.width() || 1));
            }
            layout();
        }

        function startDrag(e: JQuery.TriggeredEvent): void {
            e.preventDefault(); // prevent image dragging / text selection
            // Ensure handle receives focus so subsequent key presses work
            $handle.trigger('focus');
            $(document).on('mousemove.imageslider touchmove.imageslider', function (ev) {
                const p = pointOf(ev);
                pointerToPosition(p.pageX, p.pageY);
            }).on('mouseup.imageslider touchend.imageslider touchcancel.imageslider', function () {
                $(document).off('.imageslider');
            });
        }

        $handle.on('mousedown touchstart', startDrag);

        $wrapper.on('click', function (e) {
            if ($(e.target).closest('.mw-imageslider-handle').length) { return; }
            pointerToPosition(e.pageX, e.pageY);
            // After jump, move focus to handle for immediate keyboard interaction
            $handle.trigger('focus');
        });

        $handle.on('keydown', function (e) {
            const dec = orientation === 'horizontal' ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft', 'ArrowDown'];
            const inc = orientation === 'horizontal' ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight', 'ArrowUp'];
            if (dec.indexOf(e.key) !== -1) { position = clamp(position - STEP); layout(); e.preventDefault(); }
            else if (inc.indexOf(e.key) !== -1) { position = clamp(position + STEP); layout(); e.preventDefault(); }
            else if (e.key === 'Home') { position = 0; layout(); e.preventDefault(); }
            else if (e.key === 'End') { position = 1; layout(); e.preventDefault(); }
        });

        $(window).on('resize.imageslider', layout);

        // Ensure layout after images load
        const imgs = [$before[0], $after[0]];
        let loaded = 0;
        function done(): void { if (++loaded === imgs.length) { layout(); } }
        imgs.forEach(function (el) { if (el.complete) { done(); } else { $(el).one('load', done); } });
    }

    function initAll(): void { $('.mw-imageslider-wrapper').each(function () { initSlider($(this)); }); }

    if (window.mediaWiki) { mw.hook('wikipage.content').add(initAll); } else { $(initAll); }
}());
