<?php

namespace ImageSlider;

use Parser;
use PPFrame;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title; // For backward compatibility if still present
use MediaWiki\Title\TitleFactory;

class Hooks
{
    /**
     * Register parser function.
     */
    public static function onParserFirstCallInit(Parser $parser): void
    {
        $parser->setFunctionHook('imageslider', [self::class, 'renderImageSlider'], Parser::SFH_OBJECT_ARGS);
    }

    /**
     * Render the slider.
     * Usage: {{#imageslider:Image1=File:Example1.jpg|Image2=File:Example2.jpg|width=900px}}
     */
    public static function renderImageSlider(Parser $parser, PPFrame $frame, array $args)
    {
        $named = self::parseArgs($frame, $args);
        // Accept only Image1 / Image2 (case-insensitive variants) as parameters.
        $file1Name = $named['Image1'] ?? $named['image1'] ?? null;
        $file2Name = $named['Image2'] ?? $named['image2'] ?? null;
        $width = $named['width'] ?? 'auto';
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

        $fileUrl1 = self::fileUrlFromName($file1Name);
        $fileUrl2 = self::fileUrlFromName($file2Name);
        if (!$fileUrl1 || !$fileUrl2) {
            return self::errorOutput($parser, 'imageslider-missing-file');
        }

        $parser->getOutput()->addModules(['ext.ImageSlider']);

        // Width handling: if provided, enforce explicit width; otherwise fluid 100%.
        $containerStyle = '';
        $pixelWidthAttr = null;
        if ($width !== 'auto') {
            $safeWidth = htmlspecialchars($width);
            // If pixel value (e.g. 900px or numeric), set fixed width; else treat as generic CSS length/percentage.
            if (preg_match('/^\d+$/', $width)) {
                $safeWidth .= 'px';
            }
            if (preg_match('/^\d+px$/i', $safeWidth)) {
                $pixelWidthAttr = $safeWidth; // use as width attribute for initial layout stability
            }
            $containerStyle = 'width:' . $safeWidth . ';';
        } else {
            $containerStyle = 'width:100%;';
        }

        $htmlClass = class_exists('\\MediaWiki\\Html\\Html') ? '\\MediaWiki\\Html\\Html' : (class_exists('\\Html') ? '\\Html' : null);
        if ($htmlClass === null) {
            return self::errorOutput($parser, 'imageslider-missing-file'); // fallback error
        }
        $imgCommon = ['alt' => ''];
        if ($pixelWidthAttr) {
            $imgCommon['width'] = rtrim($pixelWidthAttr, 'px');
        }
        $outerClasses = 'mw-imageslider mw-imageslider-' . $orientation;
        // aria-orientation should match movement axis: vertical slider means left/right adjustment ⇒ aria-orientation="vertical" is incorrect.
        // According to WAI-ARIA, orientation describes the axis of the slider track. Our vertical mode track is vertical visually (divider runs top->bottom while moving left/right?).
        // To simplify: align aria-orientation with configured orientation for user expectation.
        $ariaOrientation = $orientation;
        $html = $htmlClass::rawElement(
            'div',
            ['class' => $outerClasses, 'style' => $containerStyle, 'data-orientation' => $orientation],
            $htmlClass::rawElement(
                'div',
                ['class' => 'mw-imageslider-wrapper', 'data-width' => $width],
                $htmlClass::element('img', $imgCommon + ['class' => 'mw-imageslider-img before', 'src' => $fileUrl1]) .
                    $htmlClass::element('img', $imgCommon + ['class' => 'mw-imageslider-img after', 'src' => $fileUrl2]) .
                    $htmlClass::rawElement('div', ['class' => 'mw-imageslider-handle', 'role' => 'slider', 'tabindex' => '0', 'aria-label' => 'Drag to compare', 'aria-orientation' => $ariaOrientation, 'aria-valuemin' => '0', 'aria-valuemax' => '100', 'aria-valuenow' => '50'], '<span class="mw-imageslider-grip"></span>')
            )
        );

        return [$html, 'isHTML' => true, 'noparse' => true];
    }

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

    private static function fileUrlFromName(string $name): ?string
    {
        $services = MediaWikiServices::getInstance();
        // Prefer TitleFactory (modern)
        if (class_exists(TitleFactory::class)) {
            $title = $services->getTitleFactory()->newFromText($name, NS_FILE);
        } else {
            // Fallback to legacy global Title class if available
            $title = class_exists('\\Title') ? \Title::newFromText($name, NS_FILE) : null;
        }
        if (!$title) {
            return null;
        }
        $file = $services->getRepoGroup()->findFile($title);
        if (!$file) {
            return null;
        }
        return $file->getFullUrl();
    }

    private static function errorOutput(Parser $parser, string $msgKey)
    {
        $parser->addTrackingCategory('imageslider-tracking-category');
        $htmlClass = class_exists('\\MediaWiki\\Html\\Html') ? '\\MediaWiki\\Html\\Html' : (class_exists('\\Html') ? '\\Html' : null);
        $html = $htmlClass ? $htmlClass::element('div', ['class' => 'error imageslider-error'], wfMessage($msgKey)->inContentLanguage()->text()) : '<div class="error imageslider-error">' . htmlspecialchars(wfMessage($msgKey)->inContentLanguage()->text()) . '</div>';
        return [$html, 'isHTML' => true];
    }
}
