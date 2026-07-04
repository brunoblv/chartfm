import { prisma } from "@/lib/prisma";
import { COPA_SINGLES_COUNT, isCopaSingleFilled, mergeArtistSingles } from "@/lib/copa";

export type CopaIncompleteRecipient = {
  userId: string;
  name: string;
  handle: string;
  artistCount: number;
  missingSingles: number;
  missingArtists: number;
};

export async function getCopaIncompleteSinglesRecipients(copaId: string): Promise<CopaIncompleteRecipient[]> {
  const copa = await prisma.copaEdition.findUnique({
    where: { id: copaId },
    select: { id: true, artistsPerUser: true },
  });
  if (!copa) return [];

  const [participants, artists] = await Promise.all([
    prisma.copaParticipant.findMany({
      where: { copaId },
      include: { user: { select: { id: true, name: true, handle: true } } },
    }),
    prisma.copaArtist.findMany({
      where: { copaId },
      include: { singles: { orderBy: { slotIndex: "asc" } } },
    }),
  ]);

  const artistsByOwner = new Map<string, typeof artists>();
  for (const artist of artists) {
    const list = artistsByOwner.get(artist.ownerId) ?? [];
    list.push(artist);
    artistsByOwner.set(artist.ownerId, list);
  }

  const recipients: CopaIncompleteRecipient[] = [];

  for (const participant of participants) {
    const pArtists = artistsByOwner.get(participant.userId) ?? [];
    let missingSingles = 0;

    for (const artist of pArtists) {
      const merged = mergeArtistSingles(
        artist.singles.map((s) => ({ slotIndex: s.slotIndex, songName: s.songName, songId: s.songId })),
        [],
      );
      for (const single of merged) {
        if (!isCopaSingleFilled(single)) missingSingles++;
      }
    }

    const missingArtists = Math.max(0, copa.artistsPerUser - pArtists.length);
    if (missingSingles === 0 && missingArtists === 0) continue;

    recipients.push({
      userId: participant.userId,
      name: participant.user.name,
      handle: participant.user.handle,
      artistCount: pArtists.length,
      missingSingles,
      missingArtists,
    });
  }

  return recipients.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function countFilledSingles(
  singles: { slotIndex: number; songName: string; songId: string | null }[],
): number {
  const merged = mergeArtistSingles(singles, []);
  return merged.filter(isCopaSingleFilled).length;
}

export function expectedSinglesForParticipant(artistCount: number): number {
  return artistCount * COPA_SINGLES_COUNT;
}

/** Notifica só inscritos com músicas ou artistas incompletos — não publica no feed global. */
export async function notifyCopaIncompleteSingles(
  copaId: string,
  text: string,
  targetUrl = "/copa/meu-time",
): Promise<{ sent: number; recipients: CopaIncompleteRecipient[] }> {
  const recipients = await getCopaIncompleteSinglesRecipients(copaId);
  if (!recipients.length) return { sent: 0, recipients: [] };

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      recipientId: r.userId,
      actorId: null,
      type: "copa_singles_reminder",
      text,
      targetUrl,
      read: false,
    })),
  });

  return { sent: recipients.length, recipients };
}
