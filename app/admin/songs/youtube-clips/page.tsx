import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { countSongsWithoutClips } from "@/lib/youtube-music-clip-backfill";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { YouTubeClipsBackfillClient } from "./YouTubeClipsBackfillClient";

export const dynamic = "force-dynamic";

export default async function YouTubeClipsPage() {
  const totalWithoutClips = await countSongsWithoutClips();

  return (
    <div style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
            Video Clipes do YouTube
          </h1>
          <span
            style={{
              background: "#FA243C",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {totalWithoutClips} pendentes
          </span>
        </div>

        <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 700 }}>
          Gerencie a busca automática de video clipes para músicas no YouTube. Sistema busca por clipes oficiais,
          excluindo lyrics videos e visualizers. Músicas sem clipes encontrados são marcadas para revisão manual.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/dados" style={adminNavChipStyle}>
            ← Voltar para Dados
          </Link>
        </div>
      </div>

      <YouTubeClipsBackfillClient initialTotal={totalWithoutClips} />
    </div>
  );
}
