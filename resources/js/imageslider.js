/*
 * Simple before/after image slider (no external deps beyond MW/jQuery)
 * Inspired by common before/after sliders; original implementation written for this extension.
 */
( function () {
    function initSlider( $wrapper ) {
        if ( $wrapper.data( 'imageslider-init' ) ) return;
        $wrapper.data( 'imageslider-init', true );

    var $before = $wrapper.find( 'img.before' );
    var $after = $wrapper.find( 'img.after' );
        var $handle = $wrapper.find( '.mw-imageslider-handle' );
        if ( !$before.length || !$after.length ) return;

        // Wrap images for clipping
    $before.wrap( '<div class="mw-imageslider-before"></div>' );
    $after.wrap( '<div class="mw-imageslider-after"></div>' );
        var $beforeWrap = $wrapper.find( '.mw-imageslider-before' );
        var $afterWrap = $wrapper.find( '.mw-imageslider-after' );

    // Set initial position (50%)
    var position = 0.5;

        function layout() {
            var w = $wrapper.width();
            var naturalWidth = $before[0].naturalWidth || w;
            var naturalHeight = $before[0].naturalHeight || $before.height();
            if ( naturalWidth && naturalHeight ) {
                var targetHeight = Math.round( ( naturalHeight / naturalWidth ) * w );
                $wrapper.css( { height: targetHeight + 'px' } );
            }
            var clipX = Math.round( w * position );
            // Full width layers; only clip-path / mask reveals portion. Use CSS var for paint efficiency.
            $wrapper[0].style.setProperty( '--imageslider-reveal', clipX + 'px' );
            $handle.css( { left: clipX + 'px' } );
            $handle.attr( 'aria-valuenow', Math.round( position * 100 ) );
        }

        function setPositionFromEvent( e ) {
            var off = $wrapper.offset();
            var x = e.pageX - off.left;
            var w = $wrapper.width();
            position = Math.min( 1, Math.max( 0, x / w ) );
            layout();
        }

        function startDrag( e ) {
            e.preventDefault();
            $( document ).on( 'mousemove.imageslider touchmove.imageslider', function ( ev ) {
                var pageX = ev.pageX;
                if ( ev.originalEvent.touches && ev.originalEvent.touches[0] ) {
                    pageX = ev.originalEvent.touches[0].pageX;
                }
                setPositionFromEvent( { pageX: pageX } );
            } ).on( 'mouseup.imageslider touchend.imageslider touchcancel.imageslider', function () {
                $( document ).off( '.imageslider' );
            } );
        }

        $handle.on( 'mousedown', startDrag );
        $handle.on( 'touchstart', startDrag );
        // Allow click / tap anywhere on wrapper to reposition instantly
        $wrapper.on( 'click', function ( e ) {
            // Ignore direct clicks on handle (drag already handles)
            if ( $( e.target ).closest( '.mw-imageslider-handle' ).length ) { return; }
            var off = $wrapper.offset();
            var x = e.pageX - off.left;
            var w = $wrapper.width();
            position = Math.min( 1, Math.max( 0, x / w ) );
            layout();
        } );

        $handle.on( 'keydown', function ( e ) {
            if ( e.key === 'ArrowLeft' || e.key === 'ArrowDown' ) {
                position = Math.max( 0, position - 0.02 );
                layout();
                e.preventDefault();
            } else if ( e.key === 'ArrowRight' || e.key === 'ArrowUp' ) {
                position = Math.min( 1, position + 0.02 );
                layout();
                e.preventDefault();
            } else if ( e.key === 'Home' ) {
                position = 0; layout(); e.preventDefault();
            } else if ( e.key === 'End' ) {
                position = 1; layout(); e.preventDefault();
            }
        } );

        // Re-layout on window resize
        $( window ).on( 'resize', layout );

        // Wait for images load
    var remaining = 2;
    function maybe() { if ( --remaining === 0 ) layout(); }
    if ( $before[0].complete ) { maybe(); } else { $before.on( 'load', maybe ); }
    if ( $after[0].complete ) { maybe(); } else { $after.on( 'load', maybe ); }
    }

    function initAll() {
        $( '.mw-imageslider-wrapper' ).each( function () { initSlider( $( this ) ); } );
    }

    if ( window.mediaWiki ) {
        mw.hook( 'wikipage.content' ).add( initAll );
    } else {
        $( initAll );
    }
}() );
