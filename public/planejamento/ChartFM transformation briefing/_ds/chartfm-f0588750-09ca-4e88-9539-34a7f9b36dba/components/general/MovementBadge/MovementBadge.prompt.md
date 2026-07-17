MovementBadge from chartfm. Use via `window.ChartFM.MovementBadge` (bundle loaded from the root `_ds_bundle.js`).

## Examples

### Up

```jsx
() => <MovementBadge status="up" delta={4} />
```

### Down

```jsx
() => <MovementBadge status="down" delta={2} />
```

### Same

```jsx
() => <MovementBadge status="same" />
```

### New

```jsx
() => <MovementBadge status="new" />
```

### Return

```jsx
() => <MovementBadge status="return" />
```

### AllStatuses

```jsx
() => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <MovementBadge status="up" delta={4} />
    <MovementBadge status="down" delta={2} />
    <MovementBadge status="same" />
    <MovementBadge status="new" />
    <MovementBadge status="return" />
  </div>
)
```
