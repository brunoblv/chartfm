import Link from "next/link";
import { getServerSession } from "next-auth";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getActiveClubeRound } from "@/lib/clube-album";
import { getCriticsFMAlbums, getTopRatedAlbums } from "@/lib/criticsfm-data";
import { ClubeDoAlbum } from "./ClubeDoAlbum";
import { TopAlbumsSection } from "./TopAlbumsSection";

export const revalidate = 60;

function ReviewsLinkButton() {
  return (
    <Link
      href="/criticsfm/reviews"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-muted)",
        textDecoration: "none",
        padding: "9px 16px",
        borderRadius: 10,
        border: "1px solid var(--divider)",
        background: "var(--surface)",
        marginBottom: 4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      Ver todos os reviews
    </Link>
  );
}

export default async function CriticsFMPage() {
  const session = await getServerSession(authOptions);
  const [albums, round] = await Promise.all([
    getCriticsFMAlbums(),
    getActiveClubeRound(session?.user?.id ?? null),
  ]);
  const topAlbums = getTopRatedAlbums(albums);

  return (
    <Shell
      title="CriticsFM"
      subtitle="Avaliações e rankings da comunidade ChartFM"
      headerRight={<ReviewsLinkButton />}
    >
      <ClubeDoAlbum round={round} />
      <TopAlbumsSection albums={topAlbums} />
    </Shell>
  );
}
