import { prisma } from "@/lib/prisma";
import { getAdminAccess } from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { FlagsAdminClient } from "./FlagsAdminClient";

export const dynamic = "force-dynamic";

export default async function DadosFlagsPage() {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const flags = await prisma.songFlag.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      user: { select: { handle: true, name: true } },
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          _count: { select: { entries: true } },
        },
      },
    },
  });

  const groupsMap = new Map<string, {
    song: (typeof flags)[number]["song"];
    reports: { id: string; reason: string | null; createdAt: Date; user: { handle: string; name: string } }[];
  }>();
  for (const f of flags) {
    const existing = groupsMap.get(f.song.id);
    if (existing) {
      existing.reports.push({ id: f.id, reason: f.reason, createdAt: f.createdAt, user: f.user });
    } else {
      groupsMap.set(f.song.id, {
        song: f.song,
        reports: [{ id: f.id, reason: f.reason, createdAt: f.createdAt, user: f.user }],
      });
    }
  }
  const groups = [...groupsMap.values()].sort((a, b) => b.reports.length - a.reports.length);

  return (
    <DadosShell active="flags" subtitle="Sinalizações de usuários" showMinhasParadas={access.isOwner}>
      <p style={{ marginTop: 0, marginBottom: 16, color: "var(--text-muted)", fontSize: 14, maxWidth: 720, lineHeight: 1.5 }}>
        Músicas que usuários marcaram como incorretas. Escolha a música correta e faça o merge (move as
        paradas para ela e apaga a sinalizada), ou dispense se a música estiver certa.
      </p>
      <FlagsAdminClient groups={groups} />
    </DadosShell>
  );
}
