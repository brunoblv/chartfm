import { PositionNumber } from "chartfm";

export const First = () => <PositionNumber n={1} />;

export const Large = () => <PositionNumber n={42} size={34} />;

export const Ranking = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <PositionNumber n={1} />
    <PositionNumber n={2} />
    <PositionNumber n={3} />
    <PositionNumber n={100} />
  </div>
);
