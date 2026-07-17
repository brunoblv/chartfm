Cover from chartfm. Use via `window.ChartFM.Cover` (bundle loaded from the root `_ds_bundle.js`).

## Examples

### Brand

```jsx
() => (
  <Cover cover={{ palette: ["#FA243C", "#FF5858"], seed: 2 }} size={140} rounded={16} />
)
```

### Small

```jsx
() => (
  <Cover cover={{ palette: ["#1D1D1F", "#3A3A3C"], seed: 9 }} size={56} />
)
```

### Variants

```jsx
() => (
  <div style={{ display: "flex", gap: 12 }}>
    {[0, 1, 2, 3, 4].map((s) => (
      <Cover key={s} cover={{ palette: ["#7B61FF", "#00C2FF"], seed: s }} size={72} />
    ))}
  </div>
)
```
