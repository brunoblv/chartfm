import { MovementBadge } from "chartfm";

export const Up = () => <MovementBadge status="up" delta={4} />;

export const Down = () => <MovementBadge status="down" delta={2} />;

export const Same = () => <MovementBadge status="same" />;

export const New = () => <MovementBadge status="new" />;

export const Return = () => <MovementBadge status="return" />;

export const AllStatuses = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <MovementBadge status="up" delta={4} />
    <MovementBadge status="down" delta={2} />
    <MovementBadge status="same" />
    <MovementBadge status="new" />
    <MovementBadge status="return" />
  </div>
);
