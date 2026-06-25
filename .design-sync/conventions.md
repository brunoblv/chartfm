# ChartFM UI primitives

A small set of presentational primitives from the ChartFM music-chart app. They are
self-styled (inline styles + design tokens) and need **no provider wrapper** — render
any of them directly. All components are on `window.ChartFM`.

## Theming & setup

No wrapper component. Colors come from CSS custom properties defined in `styles.css`
(which `@import`s `_ds_bundle.css`). The token `:root` block is light mode; add
`data-theme="dark"` to any ancestor element to switch the whole subtree to dark tokens:

```jsx
<div data-theme="dark" style={{ background: "var(--bg)", padding: 24 }}>
  <PositionNumber n={1} />
</div>
```

`PositionNumber` reads `var(--text)`, so it follows the theme automatically. The other
four take explicit color props (palettes/status) and look the same in both themes.

## Styling idiom: design tokens, not utility classes

There are **no CSS classes** to apply. Style your own layout glue with the same
`var(--*)` tokens the components use, so it stays on-brand. Real token names (all in
`_ds_bundle.css`):

| Group | Tokens |
|---|---|
| Brand | `--accent` `--accent-hover` `--accent-tint` `--gradient-hero` `--shadow-hero` |
| Surfaces | `--bg` `--surface` `--surface-elevated` `--sidebar-bg` `--fill-subtle` `--fill-inset` |
| Text | `--text` `--text-subtle` `--text-muted` `--text-disabled` |
| Dividers | `--divider` `--divider-soft` `--divider-strong` |
| Movement | `--up-bg`/`--up-fg` `--down-bg`/`--down-fg` `--same-bg`/`--same-fg` `--new-bg`/`--new-fg` |

The brand accent is `#FA243C` (`--accent`); the app font is the native system stack
(`-apple-system, "SF Pro Display", "Inter", system-ui`) — don't load a webfont.

## The components (props from the shipped `.d.ts`)

- **ChartFMLogo** — `{ size?=32, style? }`. The app's bar-chart wordmark (red gradient).
- **PositionNumber** — `{ n, size?=22 }`. Tabular chart-rank number; right-aligned, uses `var(--text)`.
- **MovementBadge** — `{ status: "new"|"return"|"up"|"down"|"same", delta?, compact? }`. Rank-movement pill. `up`/`down` show `delta` with an arrow.
- **Cover** — `{ cover: { palette: [string,string], seed: number, imageUrl? }, song?, size?=56, rounded?=10 }`. Album cover; with no `imageUrl` it renders a deterministic generative gradient keyed by `seed` (variant = `seed % 5`).
- **VideoClipCover** — `{ imageUrl?, paletteA?, paletteB?, seed?, width?=320, height?, matchSiblingHeight? }`. 16:9 clip thumbnail; gradient + camera glyph when no `imageUrl`.

## Where the truth lives

Read `styles.css` and its import `_ds_bundle.css` for the full token set (light + dark),
and `components/general/<Name>/<Name>.prompt.md` for per-component usage.

## Idiomatic snippet — a chart row

```jsx
<div data-theme="light" style={{ display: "flex", alignItems: "center", gap: 12,
     padding: "10px 14px", background: "var(--surface)",
     borderBottom: "1px solid var(--divider)" }}>
  <PositionNumber n={1} />
  <Cover cover={{ palette: ["#FA243C", "#FF5858"], seed: 2 }} size={48} />
  <div style={{ flex: 1, color: "var(--text)", fontWeight: 600 }}>Song title</div>
  <MovementBadge status="up" delta={3} />
</div>
```
