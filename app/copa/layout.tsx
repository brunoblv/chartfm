import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { CopaNav } from "./CopaNav";

export const metadata: Metadata = {
  title: "Copa ChartFM",
  description: "Torneio musical da comunidade ChartFM - grupos, jogos ao vivo e chaveamento",
};

export default async function CopaLayout({ children }: { children: React.ReactNode }) {
  await getServerSession(authOptions);
  return (
    <Shell noPadding>
      <CopaNav />
      <div style={{ padding: "0 0 80px 0" }}>{children}</div>
    </Shell>
  );
}
