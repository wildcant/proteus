# Brand marks

The wordmark, the favicon and the touch icons in `~/designs/proteus/Proteus.figcraft`, page `brand`, and the store's icon set (`Icon`, page `components/ui`). The marks are the TanStack starter's placeholder images, reproduced unchanged: `favicon.ico`, `logo192.png` and `logo512.png` in `apps/store/public/`, named in `manifest.json`. The wordmark is text.

The blueprint carries no brand (`PRODUCT.md`, "Brand Commitments"). Its marks are neutral placeholders; a fork replaces them on this page and exports.

## Wordmark

- The store's name set in `type/heading` (Manrope ExtraBold, uppercase), `color/ink`, hover `color/ink-muted`. One component, `Wordmark` (`apps/store/src/components/store/wordmark/wordmark.tsx`), used by every layout that renders chrome.
- It is a component, so its set lives on `components/store`, not on `brand`. The `brand` page holds an instance of it as a reference only.
- A fork with a drawn wordmark draws it on `components/store` and the exporter's icon or vector support decides how it reaches code; that is a coding-session item.

## The page

Three sections. A script reads them by name, so keep the names.

- `sources`: the components every export frame is built from, and a `Wordmark` instance for reference. Today that is `StarterMark`, one variant per shipped pixel size (`size=16|24|32|64|192|512`), each the starter's raster placed at 1×. Edit the mark here.
- `export`: one frame per image file the store ships. Each frame is named exactly like its file, without the extension, and sized at the file's pixel size, so it exports at 1×.
- `preview`: legibility checks (browser tab at 16 and 32 px, a home-screen icon at 60 px, light and dark). Never exported.

The export rule: the brand export reads only the direct child frames of the section named `export` on page `brand`. A section whose name starts with `preview` is skipped, and so is everything in `sources`. Each export frame carries `pluginData` `{kind: "brandExport", file, px}` (the target file inside `apps/store/public/`, such as `logo192.png`, and the pixel size; `.png`, `.svg` or `.ico`) and a matching PNG export setting, so the script can trust either. The export records each file's size and hash in the snapshot; never edit the images by hand.

## Export frames

What the store ships today, one frame each, an instance of `StarterMark` at the matching size:

- `favicon` × 4: 16, 24, 32 and 64 px, all with file `favicon.ico`. The export packs the four PNGs into the `.ico`, smallest first, as the starter's file holds them.
- `logo192`: 192 px, `logo192.png`.
- `logo512`: 512 px, `logo512.png`.

The starter's images carry their own colours (a cyan mark, transparent or on a near-black tile), which no `color/*` role holds. A fork's own mark binds `color/*` roles only; a colour with no role is a token gap for the owner.

## Icons

The `Icon` set on `components/ui`: one variant per glyph, `name=<kebab-case>`, 24 × 24, one colour bound to `color/ink` (exported as `currentColor`). `icons:export` writes `apps/store/src/components/ui/icon/icon.glyphs.tsx`.

- The Lucide glyphs reproduce `lucide-react` 0.545.0 exactly (stroke 2, round caps and joins), each named like the store's import without `Icon` (`loader-2`, `more-vertical`, `trash-2`). Lucide is licensed under ISC: Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025. Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
- `bag` (stroke 1.5) and `user` (filled) are the store's own marks, not Lucide glyphs.
- The payment network marks (Visa, Mastercard, Amex) are several colours and are not in the set.

## For the app config

- `manifest.json` still names the starter app ("Create TanStack App Sample") with `theme_color` #000000. The brand slice repoints its name and icons, and `theme_color` / `background_color` at the `surface` and `ink` values.
