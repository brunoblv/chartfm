import { ChartFMLogo } from "chartfm";

export const Default = () => <ChartFMLogo />;

export const Large = () => <ChartFMLogo size={80} />;

export const Sizes = () => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
    <ChartFMLogo size={24} />
    <ChartFMLogo size={40} />
    <ChartFMLogo size={64} />
  </div>
);
