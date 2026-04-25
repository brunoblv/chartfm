import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface ShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  noPadding?: boolean;
}

export function Shell({ children, title, subtitle, noPadding }: ShellProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FBFBFD" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar title={title} subtitle={subtitle} />
        <main style={noPadding ? {} : { padding: "36px 40px 80px 40px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
