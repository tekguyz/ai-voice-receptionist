# Fonts for drawn images

`ImageResponse` (the link preview picture, `app/opengraph-image.tsx`) cannot
use `next/font` and cannot read WOFF2, so it reads these TTF files.

| File | Font | Source |
|---|---|---|
| `barlow-condensed-800.ttf` | Barlow Condensed ExtraBold | `github.com/google/fonts`, `ofl/barlowcondensed/BarlowCondensed-ExtraBold.ttf` |
| `barlow-500.ttf` | Barlow Medium | `github.com/google/fonts`, `ofl/barlow/Barlow-Medium.ttf` |

Downloaded 2026-10-07. Licence: SIL Open Font License 1.1 (Copyright 2017
The Barlow Project Authors). They are the same faces the app loads with
`next/font` in `app/layout.tsx`.
