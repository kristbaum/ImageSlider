<?php

declare(strict_types=1);

namespace ImageSlider;

// Imports for global MediaWiki core symbols so static analyzers resolve them correctly.
use Parser;
use PPFrame;
use function wfMessage;
use const NS_FILE;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\TitleFactory;

class Hooks
{
    /**
     * Default pixel width when width is omitted.
     */
    private const DEFAULT_WIDTH = 900;

    /**
     * Hard ceiling to avoid requesting extremely large thumbs.
     */
    private const MAX_THUMB_WIDTH = 4096;
    /**
     * Register parser function.
     */
    /**
     * @param Parser $parser
     */
    public static function onParserFirstCallInit(Parser $parser): void
    {
        $parser->setFunctionHook('imageslider', [self::class, 'renderImageSlider'], \Parser::SFH_OBJECT_ARGS);
    }

    /**
     * Render the slider.
     * Usage: {{#imageslider:Image1=File:Example1.jpg|Image2=File:Example2.jpg|width=900px}}
     */
    /**
     * Parser function callback for #imageslider.
     * @param Parser $parser
     * @param PPFrame $frame
     * @param array $args Raw argument nodes
     * @return array HTML + flags per Parser function contract
     */
    public static function renderImageSlider(Parser $parser, PPFrame $frame, array $args): array
    {
        $named = self::parseArgs($frame, $args);
        // Accept only Image1 / Image2 (case-insensitive variants) as parameters.
        $file1Name = $named['Image1'] ?? $named['image1'] ?? null;
        $file2Name = $named['Image2'] ?? $named['image2'] ?? null;
        // Width: only pixel values are supported (e.g. 800 or 800px). Anything else falls back to default.
        $rawWidth = $named['width'] ?? '';
        $pixelWidth = self::extractPixelWidth($rawWidth) ?? self::DEFAULT_WIDTH;
        if ($pixelWidth > self::MAX_THUMB_WIDTH) {
            $pixelWidth = self::MAX_THUMB_WIDTH;
        }
        $width = $pixelWidth . 'px';
        $orientation = strtolower($named['orientation'] ?? $named['mode'] ?? 'vertical');
        if (!in_array($orientation, ['vertical', 'horizontal'], true)) {
            $orientation = 'vertical';
        }

        if (!$file1Name || !$file2Name) {
            // Fallback: treat any values starting with File: as positional in order
            $fileCandidates = [];
            foreach ($named as $k => $v) {
                if (is_string($v) && stripos($v, 'File:') === 0) {
                    $fileCandidates[] = $v;
                }
            }
            if (count($fileCandidates) >= 2) {
                $file1Name = $file1Name ?: $fileCandidates[0];
                $file2Name = $file2Name ?: $fileCandidates[1];
            }
        }
        if (!$file1Name || !$file2Name) {
            return self::errorOutput($parser, 'imageslider-missing-param');
        }

        // Use sanitized pixel width for thumbnail generation.
        $fileUrl1 = self::fileUrlFromName($file1Name, $pixelWidth);
        $fileUrl2 = self::fileUrlFromName($file2Name, $pixelWidth);
        if (!$fileUrl1 || !$fileUrl2) {
            return self::errorOutput($parser, 'imageslider-missing-file');
        }

        $parser->getOutput()->addModules(['ext.ImageSlider']);

        // Width handling: always fixed pixel width.
        $safeWidth = htmlspecialchars($width, ENT_QUOTES);
        $pixelWidthAttr = $safeWidth; // numeric px width attribute
        $containerStyle = 'width:' . $safeWidth . ';';

        $htmlClass = class_exists('\\MediaWiki\\Html\\Html') ? '\\MediaWiki\\Html\\Html' : (class_exists('\\Html') ? '\\Html' : null);
        if ($htmlClass === null) {
            return self::errorOutput($parser, 'imageslider-missing-file'); // fallback error
        }
        $imgCommon = ['alt' => ''];
        if ($pixelWidthAttr) {
            $imgCommon['width'] = rtrim($pixelWidthAttr, 'px');
        }
        $outerClasses = 'mw-imageslider mw-imageslider-' . $orientation;
        // Use supplied orientation directly for ARIA (track direction hint)
        $ariaOrientation = $orientation;
        $html = $htmlClass::rawElement(
            'div',
            ['class' => $outerClasses, 'style' => $containerStyle, 'data-orientation' => $orientation],
            $htmlClass::rawElement(
                'div',
                ['class' => 'mw-imageslider-wrapper', 'data-width' => $width],
                $htmlClass::element('img', $imgCommon + ['class' => 'mw-imageslider-img before', 'src' => $fileUrl1]) .
                    $htmlClass::element('img', $imgCommon + ['class' => 'mw-imageslider-img after', 'src' => $fileUrl2]) .
                    $htmlClass::rawElement('div', [
                        'class' => 'mw-imageslider-handle',
                        'role' => 'slider',
                        'tabindex' => '0',
                        'aria-label' => 'Drag to compare',
                        'aria-orientation' => $ariaOrientation,
                        'aria-valuemin' => '0',
                        'aria-valuemax' => '100',
                        'aria-valuenow' => '50'
                    ], '<span class="mw-imageslider-grip"></span>')
            )
        );

        return [$html, 'isHTML' => true, 'noparse' => true];
    }

    /**
     * Normalize and parse named args (case-insensitive keys).
     * @param PPFrame $frame
     * @param array $args
     * @return array
     */
    private static function parseArgs(PPFrame $frame, array $args): array
    {
        $out = [];
        foreach ($args as $arg) {
            // Expand (handles if arg is a node object)
            $expanded = trim($frame->expand($arg));
            if ($expanded === '') {
                continue;
            }
            $eq = strpos($expanded, '=');
            if ($eq === false) {
                // Positional value (not used but kept if future features require)
                $out[] = $expanded;
                continue;
            }
            $name = trim(substr($expanded, 0, $eq));
            $value = trim(substr($expanded, $eq + 1));
            if ($name !== '') {
                $out[$name] = $value;
                // Provide case-insensitive alias if distinct
                $lower = strtolower($name);
                if (!isset($out[$lower])) {
                    $out[$lower] = $value;
                }
            }
        }
        return $out;
    }

    /**
     * Resolve file title to a full URL or null.
     */
    private static function fileUrlFromName(string $name, ?int $thumbWidth = null): ?string
    {
        $services = MediaWikiServices::getInstance();
        // Prefer TitleFactory (modern)
        if (class_exists(TitleFactory::class)) {
            $title = $services->getTitleFactory()->newFromText($name, \NS_FILE);
        } else {
            // Fallback to legacy global Title class if available
            $title = class_exists('\\Title') ? \Title::newFromText($name, \NS_FILE) : null;
        }
        if (!$title) {
            return null;
        }
        $file = $services->getRepoGroup()->findFile($title);
        if (!$file) {
            return null;
        }
        // If a thumbnail width is requested, attempt to build a thumb.php URL (preferred lightweight) or fall back.
        if ($thumbWidth && $thumbWidth > 0) {
            $thumbWidth = max(1, min(self::MAX_THUMB_WIDTH, $thumbWidth));
            $thumbUrl = self::thumbScriptUrl($file, $thumbWidth);
            if ($thumbUrl) {
                return $thumbUrl;
            }
            // Fallback to standard transform (will create if absent)
            $transform = $file->transform(['width' => $thumbWidth]);
            if ($transform && !$transform->isError()) {
                $u = $transform->getUrl();
                if (is_string($u) && $u !== '') {
                    return $u;
                }
            }
        }
        return $file->getFullUrl();
    }

    /**
     * Extract integer pixel width from a width spec (e.g. "900", "900px", "100%" -> null).
     */
    private static function extractPixelWidth(string $widthSpec): ?int
    {
        $trim = trim($widthSpec);
        if ($trim === '') {
            return null;
        }
        if (preg_match('/^(\d+)px$/i', $trim, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^\d+$/', $trim)) {
            return (int)$trim;
        }
        return null; // percentages or other units not handled for thumbs
    }

    /**
     * Build a thumb.php URL if $wgThumbnailScriptPath is configured.
     */
    private static function thumbScriptUrl($file, int $width): ?string
    {
        // Rely on global configuration value.
        global $wgThumbnailScriptPath;
        if (!isset($wgThumbnailScriptPath) || !$wgThumbnailScriptPath) {
            return null;
        }
        // Title DB key provides underscores etc.
        $title = method_exists($file, 'getTitle') ? $file->getTitle() : null;
        if (!$title) {
            return null;
        }
        $fname = $title->getDBkey();
        // Use 'w' parameter (alias often accepted) but docs show 'w'.
        $query = http_build_query([
            'f' => $fname,
            'w' => $width
        ], '', '&', PHP_QUERY_RFC3986);
        // Ensure script path is absolute or relative as configured; leave unchanged.
        return rtrim($wgThumbnailScriptPath, '?') . '?' . $query;
    }

    /**
     * Emit standardized error with tracking category.
     */
    private static function errorOutput(Parser $parser, string $msgKey): array
    {
        $parser->addTrackingCategory('imageslider-tracking-category');
        $htmlClass = class_exists('\\MediaWiki\\Html\\Html') ? '\\MediaWiki\\Html\\Html' : (class_exists('\\Html') ? '\\Html' : null);
        $msg = wfMessage($msgKey)->inContentLanguage()->text();
        $html = $htmlClass
            ? $htmlClass::element('div', ['class' => 'error imageslider-error'], $msg)
            : '<div class="error imageslider-error">' . htmlspecialchars($msg) . '</div>';
        return [$html, 'isHTML' => true];
    }
}
