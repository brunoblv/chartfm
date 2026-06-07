import { getServerSession } from "next-auth";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getActiveClubeRound } from "@/lib/clube-album";
import { ClubeDoAlbum } from "../ClubeDoAlbum";

export const revalidate = 60;

export default async function ClubePage() {
  const session = await getServerSession(authOptions);
  const round = await getActiveClubeRound(session?.user?.id ?? null);

  return (
    <Shell
      title="Clube do Álbum"
      subtitle="Curadoria coletiva semanal da comunidade ChartFM"
      headerRight={
        <Link
          href="/criticsfm/clube/historico"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}
        >
          Histórico →
        </Link>
      }
    >
      <ClubeDoAlbum round={round} />
    </Shell>
  );
}
