# AFRIFF brand assets

## Source files

Downloaded from [afriff.com](https://www.afriff.com) on 21 Sep 2026 (served from the site's image host, static.wixstatic.com):

| File | What it is |
|---|---|
| `source/afriff-logo-main.jpg` | Main stacked logo — emblem, AFRIFF wordmark, “Africa International Film Festival” (1983×1438, JPG on white) |
| `source/afriff-logo-15th-edition.jpg` | 15th-edition logo with the “15” mark (2929×1080, JPG on white). Not used in the app yet — useful for an edition-specific hero. |

These are raster files only. **Ask the festival for official vector artwork (SVG/AI/EPS) and a brand guide** — especially a reversed (white) version of the logo for dark backgrounds — and swap it in.

## What the app uses

Built by `scripts/build_brand_assets.py` via `bun run brand:assets` from the repo root (needs Python with `pillow numpy potracer`). Outputs live in the shared theme and are served by every app that extends it:

- **Emblem** — cut from the main logo with a circular mask → `layers/ui-kit/public/brand/afriff-emblem-{96,192,384}.webp`, plus the PWA icons, Apple touch icon and favicons.
- **Wordmark and festival name** — traced to vector paths → `layers/ui-kit/components/brand/BrandWordmark.vue` / `BrandSubline.vue`. They use `currentColor`, so they're brand navy on light backgrounds and white on dark ones. The white version is derived, not official.
- **Colours** — wordmark navy sampled from the logo: `#0A1042` (`navy-900`). The emblem's blue, sky, green, yellow and red are available as `emblem-*` colours for small accents.

Gold (`accent`) is the app's call-to-action colour. The website itself uses red (`#E81F27`) for buttons — easy to switch in `layers/ui-kit/styles/theme.css` if the festival prefers.
