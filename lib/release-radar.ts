import { prisma } from "@/lib/prisma";
import { computeLatestWeeklyTopArtists } from "@/lib/global-snapshot";
import {
  getSpotifyAlbumDetails,
  getSpotifyArtistById,
  listSpotifyArtistRecentReleases,
  probeSpotifyApi,
  spotifyConfigured,
} from "@/lib/spotify-server";
import { isTelegramConfigured, sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram";
import { tryConsumeSpotifyBudget } from "@/lib/spotify-budget";
import { runWithSpotifyBackfillPool } from "@/lib/spotify-user-charts-pool";

/**
 * Radar de Lançamentos — monitora artistas no Spotify e avisa no Telegram
 * quando sai música nova (álbum ou single dentro da janela recente).
 *
 * Dedupe em `artist_release_notifications`: ao adicionar um artista, os
 * lançamentos já publicados dentro da janela são registrados com
 * `announced=false` (baseline) para o bot só anunciar o que sair depois.
 */

/** Janela (em dias) considerada "lançamento novo". */
const WINDOW_DAYS = Math.max(1, Number(process.env.RELEASE_RADAR_WINDOW_DAYS) || 14);
const DELAY_BETWEEN_ARTISTS_MS = 2000;
// Lote por execução: com o cron de hora em hora às sextas, ~200 artistas ÷ 24 execuções.
// Cada artista é checado no máximo 1x/dia (filtro por lastCheckedAt < início do dia BRT).
const BATCH_PER_RUN = Math.max(1, Number(process.env.RELEASE_RADAR_BATCH_PER_RUN) || 15);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Data de hoje em America/Sao_Paulo no formato yyyy-mm-dd. */
function todayBrt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function isoDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Só conta como recente quem tem data completa (yyyy-mm-dd) dentro da janela e
 * já lançada — datas futuras (pré-save) ficam para quando o dia chegar.
 */
function isRecentRelease(releaseDate: string | null): boolean {
  if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return false;
  return releaseDate >= isoDateDaysAgo(WINDOW_DAYS) && releaseDate <= todayBrt();
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function albumTypeLabel(albumType: string | null, totalTracks: number | null): string {
  const t = (albumType ?? "").toLowerCase();
  if (t === "single") return totalTracks != null && totalTracks >= 4 ? "EP" : "Single";
  if (t === "ep") return "EP";
  if (t === "album") return "Álbum";
  if (t === "compilation") return "Coletânea";
  return "Lançamento";
}

function formatDateBr(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type RecentRelease = {
  spotifyId: string;
  name: string;
  albumType: string | null;
  releaseDate: string | null;
};

/** Baixa a capa do álbum para mandar como foto no Telegram. */
async function fetchCover(coverUrl: string | null): Promise<Buffer | null> {
  if (!coverUrl) return null;
  try {
    const res = await fetch(coverUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function notifyRelease(artistName: string, rel: RecentRelease): Promise<boolean> {
  const details = await getSpotifyAlbumDetails(rel.spotifyId).catch(() => null);
  const typeLabel = albumTypeLabel(details?.albumType ?? rel.albumType, details?.totalTracks ?? null);
  const dateBr = formatDateBr(details?.releaseDate ?? rel.releaseDate);

  const lines = [
    "🎧 Lançamento!",
    `${artistName} - ${details?.title ?? rel.name}`,
    dateBr ? `${typeLabel} · ${dateBr}` : typeLabel,
  ];
  const caption = lines.join("\n");
  const url = details?.spotifyUrl ?? `https://open.spotify.com/album/${rel.spotifyId}`;

  const cover = await fetchCover(details?.coverUrl ?? null);
  if (cover) {
    const sent = await sendTelegramPhoto(cover, caption, url, "Ouvir no Spotify →");
    if (sent) return true;
  }
  return sendTelegramMessage(caption, url, "Ouvir no Spotify →");
}

export type ReleaseRadarRunResult = {
  ok: boolean;
  watches: number;
  checked: number;
  announced: number;
  errors: string[];
};

/**
 * Varre todos os artistas ativos e anuncia lançamentos ainda não registrados.
 * Roda inteiro no pool "backfill" (app BACKUP3) — é um job de fundo em lote,
 * isolado do app principal/backup usado por buscas/ações de usuário reais.
 */
export async function runReleaseRadar(): Promise<ReleaseRadarRunResult> {
  return runWithSpotifyBackfillPool(() => runReleaseRadarInner());
}

async function runReleaseRadarInner(): Promise<ReleaseRadarRunResult> {
  const errors: string[] = [];
  if (!spotifyConfigured()) {
    return { ok: false, watches: 0, checked: 0, announced: 0, errors: ["Spotify não configurado"] };
  }
  if (!isTelegramConfigured()) {
    errors.push("Telegram não configurado — lançamentos serão registrados sem aviso");
  }

  // Sob rate limit, varrer 200 artistas só piora a penalização — aborta e espera o próximo cron.
  const probe = await probeSpotifyApi();
  if (!probe.ok) {
    return { ok: false, watches: 0, checked: 0, announced: 0, errors: [...errors, probe.error ?? "Spotify indisponível"] };
  }

  // Lote rotativo: só artistas ainda não checados hoje (BRT), os mais "atrasados" primeiro.
  // Com o cron horário de sexta, a lista inteira se espalha ao longo do dia em vez de
  // uma varredura única — cada execução faz no máximo BATCH_PER_RUN chamadas ao Spotify.
  const now = new Date();
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayStartBrt = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 3, 0, 0),
  );

  const watches = await prisma.artistReleaseWatch.findMany({
    where: {
      active: true,
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: todayStartBrt } }],
    },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: BATCH_PER_RUN,
  });

  let checked = 0;
  let announced = 0;

  for (const watch of watches) {
    // Orçamento diário do radar esgotado → para aqui; artistas restantes ficam
    // pro próximo cron (lastCheckedAt não foi atualizado, então voltam primeiro).
    if (!tryConsumeSpotifyBudget("radar")) {
      errors.push("Orçamento diário do radar esgotado — varredura continua no próximo dia");
      break;
    }
    try {
      // maxAttempts 1: se o rate limit chegar no meio da varredura, não dormir
      // em retries por artista — o próximo cron recomeça do zero de qualquer forma.
      const releases = await listSpotifyArtistRecentReleases(watch.spotifyId, "BR", { maxAttempts: 1 });
      checked += 1;

      const recent = releases.filter((r) => isRecentRelease(r.releaseDate));
      if (recent.length > 0) {
        const known = await prisma.artistReleaseNotification.findMany({
          where: { watchId: watch.id },
          select: { albumSpotifyId: true, title: true },
        });
        const knownIds = new Set(known.map((k) => k.albumSpotifyId));
        // Dedupe também por título: relançamentos/versões por mercado reaparecem com outro id.
        const knownTitles = new Set(known.map((k) => normalizeTitle(k.title)));

        for (const rel of recent) {
          if (knownIds.has(rel.spotifyId) || knownTitles.has(normalizeTitle(rel.name))) continue;

          const sent = isTelegramConfigured() ? await notifyRelease(watch.name, rel) : false;
          await prisma.artistReleaseNotification.create({
            data: {
              watchId: watch.id,
              albumSpotifyId: rel.spotifyId,
              title: rel.name,
              albumType: rel.albumType,
              releaseDate: rel.releaseDate,
              announced: sent,
            },
          });
          knownTitles.add(normalizeTitle(rel.name));
          if (sent) announced += 1;
        }
      }

      await prisma.artistReleaseWatch.update({
        where: { id: watch.id },
        data: { lastCheckedAt: new Date() },
      });
    } catch (err) {
      errors.push(`${watch.name}: ${String(err)}`);
    }
    await sleep(DELAY_BETWEEN_ARTISTS_MS);
  }

  return { ok: true, watches: watches.length, checked, announced, errors };
}

export type AddWatchResult =
  | { ok: true; id: number; name: string; baselined: number }
  | { ok: false; error: string };

/**
 * Adiciona (ou reativa) um artista no radar. Registra como baseline os
 * lançamentos já dentro da janela para não anunciar retroativamente.
 */
export async function addReleaseWatch(spotifyId: string): Promise<AddWatchResult> {
  return runWithSpotifyBackfillPool(() => addReleaseWatchInner(spotifyId));
}

async function addReleaseWatchInner(spotifyId: string): Promise<AddWatchResult> {
  const id = spotifyId.trim();
  if (!id) return { ok: false, error: "spotifyId vazio" };

  const profile = await getSpotifyArtistById(id);
  if (!profile) return { ok: false, error: "Artista não encontrado no Spotify" };

  const watch = await prisma.artistReleaseWatch.upsert({
    where: { spotifyId: profile.spotifyId },
    create: {
      spotifyId: profile.spotifyId,
      name: profile.name,
      imageUrl: profile.imageUrl,
    },
    update: { active: true, name: profile.name, imageUrl: profile.imageUrl },
  });

  const baselined = await baselineWatch(watch.id, profile.spotifyId);
  return { ok: true, id: watch.id, name: watch.name, baselined };
}

/**
 * Registra como baseline (announced=false) os lançamentos já dentro da janela,
 * para o radar não anunciar retroativamente ao começar a monitorar o artista.
 */
async function baselineWatch(watchId: number, spotifyId: string): Promise<number> {
  let baselined = 0;
  try {
    const releases = await listSpotifyArtistRecentReleases(spotifyId);
    const recent = releases.filter((r) => isRecentRelease(r.releaseDate));
    for (const rel of recent) {
      const created = await prisma.artistReleaseNotification
        .create({
          data: {
            watchId,
            albumSpotifyId: rel.spotifyId,
            title: rel.name,
            albumType: rel.albumType,
            releaseDate: rel.releaseDate,
            announced: false,
          },
        })
        .catch(() => null); // já registrado (reativação) — ignora
      if (created) baselined += 1;
    }
  } catch (err) {
    console.error("[release-radar] baseline falhou", err);
  }
  return baselined;
}

/** Quantos artistas do topo do Global semanal entram na importação automática. */
export const GLOBAL_IMPORT_LIMIT = 200;

export type ImportGlobalResult =
  | {
      ok: true;
      weekLabel: string;
      totalTop: number;
      withSpotify: number;
      added: number;
      kept: number;
      removed: number;
    }
  | { ok: false; error: string };

/**
 * Sincroniza o radar com os artistas que mais pontuaram no Global da última
 * semana congelada (top 200): adiciona/reativa quem está no topo (source
 * "global") e remove os "global" que saíram. Artistas "manual" nunca são
 * removidos por aqui. Novos entram com baseline, sem aviso retroativo.
 */
export async function importGlobalTopArtists(): Promise<ImportGlobalResult> {
  return runWithSpotifyBackfillPool(() => importGlobalTopArtistsInner());
}

async function importGlobalTopArtistsInner(): Promise<ImportGlobalResult> {
  const top = await computeLatestWeeklyTopArtists(GLOBAL_IMPORT_LIMIT);
  if (!top) return { ok: false, error: "Nenhum snapshot do Global encontrado" };

  const rows = top.artists.filter((a) => a.spotifyId);
  const ids = rows.map((r) => r.spotifyId as string);

  const [existing, localArtists] = await Promise.all([
    prisma.artistReleaseWatch.findMany({
      select: { id: true, spotifyId: true, source: true, active: true },
    }),
    ids.length
      ? prisma.artist.findMany({
          where: { spotifyId: { in: ids } },
          select: { spotifyId: true, imageUrl: true },
        })
      : Promise.resolve([]),
  ]);
  const imageBySpotifyId = new Map(localArtists.map((a) => [a.spotifyId, a.imageUrl]));
  const existingBySpotifyId = new Map(existing.map((w) => [w.spotifyId, w]));
  const topIds = new Set(ids);

  let added = 0;
  let kept = 0;
  const newWatches: { id: number; spotifyId: string }[] = [];

  for (const row of rows) {
    const spotifyId = row.spotifyId as string;
    const current = existingBySpotifyId.get(spotifyId);
    if (current) {
      if (!current.active) {
        await prisma.artistReleaseWatch.update({ where: { id: current.id }, data: { active: true } });
      }
      kept += 1;
    } else {
      const watch = await prisma.artistReleaseWatch.create({
        data: {
          spotifyId,
          name: row.name,
          imageUrl: imageBySpotifyId.get(spotifyId) ?? null,
          source: "global",
        },
      });
      newWatches.push({ id: watch.id, spotifyId });
      added += 1;
    }
  }

  const toRemove = existing.filter((w) => w.source === "global" && !topIds.has(w.spotifyId));
  if (toRemove.length > 0) {
    await prisma.artistReleaseWatch.deleteMany({ where: { id: { in: toRemove.map((w) => w.id) } } });
  }

  for (const watch of newWatches) {
    await baselineWatch(watch.id, watch.spotifyId);
    await sleep(250);
  }

  return {
    ok: true,
    weekLabel: top.weekLabel,
    totalTop: top.artists.length,
    withSpotify: rows.length,
    added,
    kept,
    removed: toRemove.length,
  };
}

export type ReleaseWatchAdminItem = {
  id: number;
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  source: string;
  active: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastRelease: { title: string; releaseDate: string | null; announced: boolean } | null;
};

export type ReleaseNotificationAdminItem = {
  id: number;
  artistName: string;
  title: string;
  albumType: string | null;
  releaseDate: string | null;
  announced: boolean;
  notifiedAt: string;
};

export type ReleaseRadarAdminData = {
  watches: ReleaseWatchAdminItem[];
  recent: ReleaseNotificationAdminItem[];
};

export async function getReleaseRadarAdminData(): Promise<ReleaseRadarAdminData> {
  const [watches, recent] = await Promise.all([
    prisma.artistReleaseWatch.findMany({
      orderBy: { name: "asc" },
      include: {
        notifications: { orderBy: { notifiedAt: "desc" }, take: 1 },
      },
    }),
    prisma.artistReleaseNotification.findMany({
      orderBy: { notifiedAt: "desc" },
      take: 30,
      include: { watch: { select: { name: true } } },
    }),
  ]);

  return {
    watches: watches.map((w) => ({
      id: w.id,
      spotifyId: w.spotifyId,
      name: w.name,
      imageUrl: w.imageUrl,
      source: w.source,
      active: w.active,
      createdAt: w.createdAt.toISOString(),
      lastCheckedAt: w.lastCheckedAt?.toISOString() ?? null,
      lastRelease: w.notifications[0]
        ? {
            title: w.notifications[0].title,
            releaseDate: w.notifications[0].releaseDate,
            announced: w.notifications[0].announced,
          }
        : null,
    })),
    recent: recent.map((n) => ({
      id: n.id,
      artistName: n.watch.name,
      title: n.title,
      albumType: n.albumType,
      releaseDate: n.releaseDate,
      announced: n.announced,
      notifiedAt: n.notifiedAt.toISOString(),
    })),
  };
}
