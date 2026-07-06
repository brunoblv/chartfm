import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { Shell } from "@/components/layout/Shell";
import LowerThirdsYoutubeClient, { type LowerThirdEntry } from "./LowerThirdsYoutubeClient";

export const dynamic = "force-dynamic";

export default async function LowerThirdsYoutubePage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const snapshot = await getOrCreateRankingWeekSnapshot();
  const entries: LowerThirdEntry[] = snapshot.payload.weeklySongs.slice(0, 5).map((e) => ({
    position: e.position,
    title: e.song.title,
    artist: e.song.artist,
    coverUrl: e.cover?.imageUrl ?? e.song.imageUrl ?? null,
    coverPalette: (e.cover?.palette ?? ["#FA243C", "#FF5858"]) as [string, string],
    coverSeed: e.cover?.seed ?? e.position,
    status: e.status,
    delta: e.delta,
    peak: e.peak,
    weeks: e.weeks,
    numberOnes: e.numberOnes ?? 0,
  }));

  return (
    <Shell title="Lower Thirds YouTube" subtitle="Parada Global · Top 5">
      <LowerThirdsYoutubeClient
        entries={entries}
        weekLabel={snapshot.weekLabel}
        dateRange={snapshot.dateRange}
      />
    </Shell>
  );
}
