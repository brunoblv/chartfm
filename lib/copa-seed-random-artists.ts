import type { PrismaClient } from "@prisma/client";
import { getArtistColor, getArtistInitials, COPA_UNASSIGNED_GROUP } from "@/lib/copa";

const SINGLES_PER_ARTIST = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type SeedRandomOptions = {
  copaId: string;
  /** Nº de participantes-alvo (default: maxParticipants da copa). Bots são criados até atingir. */
  targetOwners?: number;
  /** Artistas por dono (default: artistsPerUser da copa). O sorteio exige todos iguais. */
  perOwner?: number;
  /** Não preenche o time de participantes humanos (default: false). */
  skipHumans?: boolean;
  /** Apenas simula — não grava nada (default: false). */
  dryRun?: boolean;
};

export type SeedRandomResult = {
  copa: { id: string; name: string; maxParticipants: number; artistsPerUser: number };
  perOwnerTarget: number;
  poolSize: number;
  addedArtists: number;
  addedOwners: number;
  perOwnerAfter: { handle: string; isBot: boolean; count: number }[];
  pending: number;
  dryRun: boolean;
};

// Preenche uma copa em inscrições com artistas ALEATÓRIOS (qualquer artista com
// ≥8 músicas no banco — sem exigir Global 100), 8 singles cada, distribuídos por
// donos-bot até a copa ficar completa e sorteável.
export async function seedCopaRandomArtists(
  prisma: PrismaClient,
  opts: SeedRandomOptions,
): Promise<SeedRandomResult> {
  const copa = await prisma.copaEdition.findUnique({
    where: { id: opts.copaId },
    include: { participants: { include: { user: { select: { id: true, handle: true } } } } },
  });
  if (!copa) throw new Error("Copa não encontrada.");
  if (copa.status !== "REGISTRATION") throw new Error(`A copa está em ${copa.status}, não em REGISTRATION.`);

  const perOwner = opts.perOwner ?? copa.artistsPerUser;
  const targetOwners = opts.targetOwners ?? copa.maxParticipants;

  const existing = await prisma.copaArtist.findMany({
    where: { copaId: copa.id },
    select: { ownerId: true, artistSpotifyId: true },
  });
  const taken = new Set(existing.map((a) => a.artistSpotifyId).filter((x): x is string => !!x));
  const countByOwner = new Map<string, number>();
  for (const a of existing) countByOwner.set(a.ownerId, (countByOwner.get(a.ownerId) ?? 0) + 1);

  // Pool: artistas com ≥8 músicas, ainda não usados nesta copa, embaralhados.
  const grouped = await prisma.song.groupBy({ by: ["artistSpotifyId"], _count: { _all: true } });
  const pool = shuffle(
    grouped
      .filter((g) => g.artistSpotifyId && g._count._all >= SINGLES_PER_ARTIST && !taken.has(g.artistSpotifyId))
      .map((g) => g.artistSpotifyId as string),
  );

  const isBot = (handle: string | null) => !!handle && /bot/i.test(handle);
  type Owner = { userId: string; handle: string; isBot: boolean; count: number };
  const owners: Owner[] = copa.participants.map((p) => ({
    userId: p.userId,
    handle: p.user.handle ?? p.userId,
    isBot: isBot(p.user.handle),
    count: countByOwner.get(p.userId) ?? 0,
  }));

  // slotInGroup é único por (copa, grupo). Em inscrições todos ficam no grupo "?".
  const maxSlot = await prisma.copaArtist.aggregate({ where: { copaId: copa.id }, _max: { slotInGroup: true } });
  let slotBase = (maxSlot._max.slotInGroup ?? -1) + 1;

  let addedOwners = 0;
  for (let k = owners.length; k < targetOwners; k++) {
    const handle = `copa-bot-${k + 1}`;
    let userId = `dry-${handle}`;
    if (!opts.dryRun) {
      const user =
        (await prisma.user.findUnique({ where: { handle } })) ??
        (await prisma.user.create({ data: { handle, name: `Bot Copa ${k + 1}`, avatarColor: "#6C5CE7" } }));
      await prisma.copaParticipant.upsert({
        where: { copaId_userId: { copaId: copa.id, userId: user.id } },
        create: { copaId: copa.id, userId: user.id },
        update: {},
      });
      userId = user.id;
    }
    owners.push({ userId, handle, isBot: true, count: 0 });
    addedOwners++;
  }

  let poolIdx = 0;
  let addedArtists = 0;
  for (const owner of owners) {
    if (opts.skipHumans && !owner.isBot) continue;
    while (owner.count < perOwner && poolIdx < pool.length) {
      const spotifyId = pool[poolIdx++];
      const artist = await prisma.artist.findUnique({
        where: { spotifyId },
        select: { name: true, exhibitionName: true, imageUrl: true },
      });
      const songs = await prisma.song.findMany({
        where: { artistSpotifyId: spotifyId },
        select: { id: true, title: true },
        take: SINGLES_PER_ARTIST,
      });
      if (!artist || songs.length < SINGLES_PER_ARTIST) continue;
      const name = artist.exhibitionName?.trim() || artist.name;
      if (!opts.dryRun) {
        await prisma.copaArtist.create({
          data: {
            copaId: copa.id,
            ownerId: owner.userId,
            groupLetter: COPA_UNASSIGNED_GROUP,
            slotInGroup: slotBase++,
            artistSpotifyId: spotifyId,
            artistName: name,
            artistImage: artist.imageUrl,
            artistColor: getArtistColor(spotifyId),
            artistInitials: getArtistInitials(name),
            singles: { create: songs.map((s, i) => ({ slotIndex: i, songName: s.title, songId: s.id })) },
          },
        });
      }
      owner.count++;
      addedArtists++;
    }
  }

  const pending = owners
    .filter((o) => !(opts.skipHumans && !o.isBot))
    .reduce((sum, o) => sum + Math.max(0, perOwner - o.count), 0);

  return {
    copa: { id: copa.id, name: `${copa.name} ${copa.year}`, maxParticipants: copa.maxParticipants, artistsPerUser: copa.artistsPerUser },
    perOwnerTarget: perOwner,
    poolSize: pool.length,
    addedArtists,
    addedOwners,
    perOwnerAfter: owners.map((o) => ({ handle: o.handle, isBot: o.isBot, count: o.count })),
    pending,
    dryRun: !!opts.dryRun,
  };
}
