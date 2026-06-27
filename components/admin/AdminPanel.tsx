import type { CSSProperties, ReactNode } from "react";
import { adminPageWrapStyle, adminPanelScrollStyle, adminPanelStyle } from "./admin-styles";

type AdminPanelProps = {
  children: ReactNode;
  maxWidth?: number;
  scroll?: boolean;
  style?: CSSProperties;
};

export function AdminPanel({ children, maxWidth = 980, scroll = true, style }: AdminPanelProps) {
  return (
    <div style={{ ...adminPageWrapStyle, maxWidth }}>
      <div style={{ ...(scroll ? adminPanelScrollStyle : adminPanelStyle), ...style }}>
        {children}
      </div>
    </div>
  );
}
