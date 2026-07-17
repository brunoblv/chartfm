ChartFMLogo from chartfm. Use via `window.ChartFM.ChartFMLogo` (bundle loaded from the root `_ds_bundle.js`).

## Examples

### Default

```jsx
() => <ChartFMLogo />
```

### Large

```jsx
() => <ChartFMLogo size={80} />
```

### Sizes

```jsx
() => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
    <ChartFMLogo size={24} />
    <ChartFMLogo size={40} />
    <ChartFMLogo size={64} />
  </div>
)
```
