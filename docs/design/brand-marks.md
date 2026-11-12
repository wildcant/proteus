# Brand marks

The wordmark, the favicon and the touch icons in `~/designs/proteus/Proteus.figcraft`, page `brand`. The page is not drawn yet: it is created in the icons-and-brand slice, and this file records the contract the brand export reads. Until then the store ships the TanStack starter's placeholder images in `apps/store/public/` (`favicon.ico`, `logo192.png`, `logo512.png`, named in `manifest.json`), and the wordmark is text.

The blueprint carries no brand (`PRODUCT.md`, "Brand Commitments"). Its marks are neutral placeholders; a fork replaces them on this page and exports.

## Wordmark

- The store's name set in `type/heading` (Manrope ExtraBold, uppercase), `color/ink`, hover `color/ink-muted`. One component, `Wordmark` (`apps/store/src/components/header/wordmark.tsx`), used by every layout that renders chrome.
- It is a component, so its set lives on `components/store`, not on `brand`. The `brand` page holds an instance of it as a reference only.
- A fork with a drawn wordmark draws it on `components/store` and the exporter's icon or vector support decides how it reaches code; that is a coding-session item.

## The page

Three sections. A script reads them by name, so keep the names.

- `sources`: the components every export frame is built from (the mark on its background, the mark alone). Edit the mark here.
- `export`: one frame per image file the store ships. Each frame is named exactly like its file, without the extension, and sized at the file's pixel size, so it exports at 1×.
- `preview`: legibility checks (browser tab at 16 and 32 px, a home-screen icon at 60 px, light and dark). Never exported.

The export rule: the brand export reads only the direct child frames of the section named `export` on page `brand`. A section whose name starts with `preview` is skipped, and so is everything in `sources`. Each export frame carries `pluginData` `{kind: "brandExport", file, px}` (the target file inside `apps/store/public/`, such as `favicon.png`, and the pixel size; `.png` or `.svg`) and a matching PNG export setting, so the script can trust either. The export records each file's size and hash in the snapshot; never edit the images by hand.

## Export frames (planned)

The set the store needs; the slice confirms names and sizes against what the root route links.

- `favicon`: 48 × 48 px, opaque, the mark on `color/surface`. Becomes `apps/store/public/favicon.png` (or the `.ico` the slice decides).
- `apple-touch-icon`: 180 × 180 px, opaque, square (iOS applies its own mask). Becomes `apps/store/public/apple-touch-icon.png`.
- `icon-192` and `icon-512`: 192 and 512 px, opaque, square, for the web manifest. Replace `logo192.png` and `logo512.png`.

Every frame binds `color/*` roles only. A mark whose colour has no role is a token gap for the owner.

## For the app config

- `manifest.json` still names the starter app ("Create TanStack App Sample") with `theme_color` #000000. The brand slice repoints its name and icons, and `theme_color` / `background_color` at the `surface` and `ink` values.
