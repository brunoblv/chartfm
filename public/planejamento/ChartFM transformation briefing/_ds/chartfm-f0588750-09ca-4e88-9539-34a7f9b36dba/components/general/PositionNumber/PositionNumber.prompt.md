PositionNumber from chartfm. Use via `window.ChartFM.PositionNumber` (bundle loaded from the root `_ds_bundle.js`).

## Examples

### First

```jsx
() => <PositionNumber n={1} />
```

### Large

```jsx
() => <PositionNumber n={42} size={34} />
```

### Ranking

```jsx
() => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <PositionNumber n={1} />
    <PositionNumber n={2} />
    <PositionNumber n={3} />
    <PositionNumber n={100} />
  </div>
)
```
