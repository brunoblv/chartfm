# design-sync notes — Chartfm

This repo is a **Next.js app**, not a component-library with a buildable `dist/`.
The sync runs in the converter's **synth/custom-entry mode** off `components/ui/`.

## Scope
Only the presentational primitives that render standalone are synced, via a custom
barrel entry (`.design-sync/ui-entry.tsx`) + `componentSrcMap` pins:
- ChartFMLogo, MovementBadge, PositionNumber, VideoClipCover, Cover

## Excluded (coupled to app/server context — would break the bundle)
- `Avatar` → imports `next/image`
- `FollowButton` → `next-auth/react` `useSession` (needs SessionProvider)
- `ThemeToggle` → app `@/components/ThemeProvider` + `useTranslations` i18n hook
- `WeekCalendar` → `@/lib/chart-cadence` date utils + stateful; lower priority, could be added later

## Build inputs
- `entry`: `.design-sync/ui-entry.tsx` (custom barrel — avoids `export *` pulling coupled deps)
- `cssEntry`: `app/globals.css` (plain CSS, defines `--text`, `--fill-subtle`, `--accent`, etc. tokens; no Tailwind `@import`)
- `tsconfig`: root `tsconfig.json` (`@/*` → `./*`); type-only imports are erased by esbuild

## Known render warns (benign — do not chase on re-sync)
- `[RENDER_THIN] ChartFMLogo` — it's a pure SVG logo with no text; the thin heuristic
  measures text/paint and finds none, but the screenshot paints the red bar-chart logo
  correctly. Confirmed benign on the contact sheet.

## Card modes
- `Cover` and `VideoClipCover` use `cardMode: "column"` (wide stories — the Variants row /
  360px Branded clip overflow a grid cell otherwise).

## Toolchain (render check)
- Converter deps live in `.ds-sync/` (gitignored): `esbuild ts-morph @types/react playwright@1.60.0`.
- `playwright@1.60.0` matches the cached Chromium build **1223** (`%LOCALAPPDATA%\ms-playwright\chromium-1223`)
  — no browser download needed. Verify with `node_modules/playwright-core/browsers.json` if the cache changes.

## Re-sync risks
- The barrel entry is hand-maintained: a new presentational primitive in `components/ui/`
  is NOT picked up automatically — add it to both `ui-entry.tsx` and `componentSrcMap`.
- The excluded components are excluded by design; re-adding any requires wiring a provider
  (`cfg.provider`) or shimming `next/image`.
