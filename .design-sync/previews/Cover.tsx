import { Cover } from "chartfm";

export const Brand = () => (
  <Cover cover={{ palette: ["#FA243C", "#FF5858"], seed: 2 }} size={140} rounded={16} />
);

export const Small = () => (
  <Cover cover={{ palette: ["#1D1D1F", "#3A3A3C"], seed: 9 }} size={56} />
);

export const Variants = () => (
  <div style={{ display: "flex", gap: 12 }}>
    {[0, 1, 2, 3, 4].map((s) => (
      <Cover key={s} cover={{ palette: ["#7B61FF", "#00C2FF"], seed: s }} size={72} />
    ))}
  </div>
);
