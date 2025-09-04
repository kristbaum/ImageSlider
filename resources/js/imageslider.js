(function () {
    var STEP = 0.02;

    function clamp(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    function initSlider($wrapper) {
        if ($wrapper.data('imageslider-init')) { return; }
        $wrapper.data('imageslider-init', true);

        var $before = $wrapper.find('img.before');
        var $after = $wrapper.find('img.after');
        var $handle = $wrapper.find('.mw-imageslider-handle');
        var orientation = ($wrapper.closest('.mw-imageslider').data('orientation') || 'vertical');
        if (!$before.length || !$after.length || !$handle.length) { return; }

        // Wrap images (clip containers)
        $before.wrap('<div class="mw-imageslider-before"></div>');
        $after.wrap('<div class="mw-imageslider-after"></div>');

        var position = 0.5; // 50%

        function layout() {
            // Maintain aspect ratio of first image
            var w = $wrapper.width();
            var natW = $before[0].naturalWidth || w;
            var natH = $before[0].naturalHeight || $before.height();
            if (natW && natH) {
                $wrapper.height(Math.round((natH / natW) * w));
            }
            var revealPx = Math.round((orientation === 'horizontal' ? $wrapper.height() : w) * position);
            $wrapper[0].style.setProperty('--imageslider-reveal', revealPx + 'px');
            if (orientation === 'horizontal') {
                $handle.css({ top: revealPx + 'px', left: '' });
            } else {
                $handle.css({ left: revealPx + 'px', top: '' });
            }
            $handle.attr('aria-valuenow', Math.round(position * 100));
        }

        function pointerToPosition(pageX, pageY) {
            var off = $wrapper.offset();
            if (orientation === 'horizontal') {
                position = clamp((pageY - off.top) / $wrapper.height());
            } else {
                position = clamp((pageX - off.left) / $wrapper.width());
            }
            layout();
        }

        function startDrag(e) {
            e.preventDefault(); // prevent image dragging / text selection
            // Ensure handle receives focus so subsequent key presses work
            $handle.trigger('focus');
            $(document).on('mousemove.imageslider touchmove.imageslider', function (ev) {
                var t = (ev.originalEvent.touches && ev.originalEvent.touches[0]) || ev;
                pointerToPosition(t.pageX, t.pageY);
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
            var dec = orientation === 'horizontal' ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft', 'ArrowDown'];
            var inc = orientation === 'horizontal' ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight', 'ArrowUp'];
            if (dec.indexOf(e.key) !== -1) { position = clamp(position - STEP); layout(); e.preventDefault(); }
            else if (inc.indexOf(e.key) !== -1) { position = clamp(position + STEP); layout(); e.preventDefault(); }
            else if (e.key === 'Home') { position = 0; layout(); e.preventDefault(); }
            else if (e.key === 'End') { position = 1; layout(); e.preventDefault(); }
        });

        $(window).on('resize.imageslider', layout);

        // Ensure layout after images load
        var imgs = [$before[0], $after[0]], loaded = 0;
        function done() { if (++loaded === imgs.length) { layout(); } }
        imgs.forEach(function (el) { if (el.complete) { done(); } else { $(el).one('load', done); } });
    }

    function initAll() { $('.mw-imageslider-wrapper').each(function () { initSlider($(this)); }); }

    if (window.mediaWiki) { mw.hook('wikipage.content').add(initAll); } else { $(initAll); }
}());
