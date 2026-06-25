import { Shell } from "@/components/layout/Shell";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import {
  getMyTrlOwnerUser,
  spotifyUserOAuthConfigured,
} from "@/lib/spotify-user";
import MonthlyPlaylistsClient from "./MonthlyPlaylistsClient";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const BRT_OFFSET_HOURS = 3;
function brtMonthStartUnix(year: number, monthIdx0: number): number {
  return Math.floor(Date.UTC(year, monthIdx0, 1, BRT_OFFSET_HOURS, 0, 0) / 1000);
}

export default async function AdminLastfmPlaylistsPage() {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return (
      <Shell title="Playlists Last.fm" subtitle="Mais ouvidas por mês">
        <div style={{ color: "var(--text-muted)" }}>Acesso restrito ao @bruno.</div>
      </Shell>
    );
  }

  const owner = await getMyTrlOwnerUser();

  const year = 2026;
  const nowUnix = Math.floor(Date.now() / 1000);
  const months: { month: number; name: string }[] = [];
  for (let m = 0; m < 12; m++) {
    if (brtMonthStartUnix(year, m) > nowUnix) break;
    months.push({ month: m + 1, name: MONTH_NAMES[m]! });
  }

  return (
    <Shell title="Playlists Last.fm" subtitle="Cria no seu Spotify as faixas mais ouvidas por mês">
      <MonthlyPlaylistsClient
        year={year}
        months={months}
        lastfmUser={owner?.lastfmUser ?? process.env.LASTFM_USERNAME ?? null}
        spotifyConfigured={spotifyUserOAuthConfigured()}
        spotifyConnected={Boolean(owner?.spotifyRefreshToken)}
      />
    </Shell>
  );
}
