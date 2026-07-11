/**
 * Inscreve participantes (e seus artistas) na Copa em fase de REGISTRATION.
 *
 * Dry-run por padrão; use --apply para gravar de fato.
 *   npx tsx scripts/inscribe-copa-participants.ts
 *   npx tsx scripts/inscribe-copa-participants.ts --apply
 *
 * Idempotente: participante já inscrito é mantido; artista já reivindicado
 * pelo próprio usuário é pulado; artista já reivindicado por OUTRO usuário
 * é reportado como conflito e não gravado.
 *
 * Usuários que não existem são CRIADOS (handle + nome, sem credenciais),
 * seguindo o precedente de lib/copa-seed-test-artists.ts.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

import { getArtistColor, getArtistInitials, COPA_UNASSIGNED_GROUP } from "../lib/copa";
import { searchSpotifyArtist } from "../lib/spotify-server";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const ROSTER: { handle: string; artists: [string, string] }[] = [
  { handle: "midnightrain", artists: ["Kesha", "Taylor Swift"] },
  { handle: "jessycv", artists: ["Luisa Sonza", "Gloria Groove"] },
  { handle: "heavydirtysoul", artists: ["Nx Zero", "CPM 22"] },
  { handle: "caiosoares", artists: ["Harry Styles", "The Weeknd"] },
  { handle: "joaoHT", artists: ["Camila Cabello", "Tate McRae"] },
  { handle: "theandre", artists: ["Lindsay Lohan", "Charli xcx"] },
  { handle: "karlacomk", artists: ["Justin Bieber", "Ashley Tisdale"] },
  { handle: "julianast", artists: ["Nelly Furtado", "Fergie"] },
  { handle: "kendikamura", artists: ["Three Days Grace", "Kings of Leon"] },
  { handle: "dudabts", artists: ["2NE1", "SEVENTEEN"] },
];

type Resolved = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  source: "catálogo" | "spotify";
};

async function resolveArtist(name: string): Promise<Resolved | null> {
  const locals = await prisma.artist.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
    orderBy: { id: "asc" },
  });
  const distinctSpotifyIds = new Set(locals.map((a) => a.spotifyId).filter(Boolean));
  if (distinctSpotifyIds.size > 1) {
    throw new Error(
      `Nome ambíguo "${name}": ${distinctSpotifyIds.size} artistas homônimos no catálogo (spotifyIds: ${[...distinctSpotifyIds].join(", ")}). Resolva manualmente informando o spotifyId correto.`,
    );
  }
  const local = locals[0];
  if (local?.spotifyId) {
    return { spotifyId: local.spotifyId, name: local.name, imageUrl: local.imageUrl, source: "catálogo" };
  }
  const sp = await searchSpotifyArtist(name);
  if (sp?.spotifyId) {
    return { spotifyId: sp.spotifyId, name: sp.name, imageUrl: sp.imageUrl ?? null, source: "spotify" };
  }
  return null;
}

(async () => {
  const copa = await prisma.copaEdition.findFirst({
    where: { status: "REGISTRATION" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true } } },
  });
  if (!copa) {
    console.error("Nenhuma Copa em fase de REGISTRATION encontrada. Abortando.");
    process.exit(1);
  }
  console.log(`Copa: ${copa.name} ${copa.year} | id=${copa.id}`);
  console.log(
    `  participantes: ${copa._count.participants}/${copa.maxParticipants} | artistas por usuário: ${copa.artistsPerUser}`,
  );
  console.log(`  modo: ${APPLY ? "APPLY (gravando)" : "DRY-RUN (nada será gravado)"}\n`);

  let errors = 0;

  // 1) Resolver usuários e artistas antes de gravar qualquer coisa
  const plan: {
    handle: string;
    userId: string | null; // null = usuário será criado no apply
    alreadyParticipant: boolean;
    artists: { input: string; resolved: Resolved | null; status: string }[];
  }[] = [];

  for (const entry of ROSTER) {
    const user = await prisma.user.findFirst({
      where: { handle: { equals: entry.handle, mode: "insensitive" } },
    });

    const participant = user
      ? await prisma.copaParticipant.findUnique({
          where: { copaId_userId: { copaId: copa.id, userId: user.id } },
        })
      : null;

    const artists: { input: string; resolved: Resolved | null; status: string }[] = [];
    for (const artistName of entry.artists) {
      const resolved = await resolveArtist(artistName);
      if (!resolved) {
        artists.push({ input: artistName, resolved: null, status: "NÃO RESOLVIDO" });
        errors++;
        continue;
      }
      const claimed = await prisma.copaArtist.findFirst({
        where: { copaId: copa.id, artistSpotifyId: resolved.spotifyId },
        include: { owner: { select: { handle: true } } },
      });
      let status: string;
      if (claimed && user && claimed.ownerId === user.id) status = "já é dele, pular";
      else if (claimed) {
        status = `CONFLITO: já reivindicado por @${claimed.owner.handle}`;
        errors++;
      } else status = "ok";
      artists.push({ input: artistName, resolved, status });
    }

    plan.push({
      handle: user?.handle ?? entry.handle,
      userId: user?.id ?? null,
      alreadyParticipant: !!participant,
      artists,
    });
  }

  // 2) Relatório
  for (const p of plan) {
    const label = !p.userId
      ? "(usuário SERÁ CRIADO + inscrito)"
      : p.alreadyParticipant
        ? "(já participante)"
        : "(novo participante)";
    console.log(`@${p.handle} ${label}`);
    for (const a of p.artists) {
      const r = a.resolved;
      console.log(
        `   ${a.input} → ${r ? `${r.name} [${r.spotifyId}] via ${r.source}` : "?"} — ${a.status}`,
      );
    }
  }

  if (!APPLY) {
    console.log(
      errors > 0
        ? `\nDRY-RUN: ${errors} problema(s) acima — resolva antes de rodar com --apply.`
        : "\nDRY-RUN ok. Rode com --apply para gravar.",
    );
    return;
  }
  if (errors > 0) {
    console.error(`\nAbortando --apply: ${errors} problema(s) no plano. Nada foi gravado.`);
    process.exit(1);
  }

  // 3) Gravar
  let nextSlot = await prisma.copaArtist.count({ where: { copaId: copa.id } });
  for (const p of plan) {
    let userId = p.userId;
    if (!userId) {
      const created = await prisma.user.create({
        data: { handle: p.handle, name: p.handle },
      });
      userId = created.id;
      console.log(`+ usuário @${p.handle}`);
    }
    if (!p.alreadyParticipant) {
      await prisma.copaParticipant.create({ data: { copaId: copa.id, userId } });
      console.log(`+ participante @${p.handle}`);
    }
    for (const a of p.artists) {
      if (!a.resolved || a.status !== "ok") continue;
      let created = false;
      for (let attempt = 0; attempt < 10 && !created; attempt++) {
        try {
          await prisma.copaArtist.create({
            data: {
              copaId: copa.id,
              ownerId: userId,
              groupLetter: COPA_UNASSIGNED_GROUP,
              slotInGroup: nextSlot,
              artistSpotifyId: a.resolved.spotifyId,
              artistName: a.resolved.name,
              artistImage: a.resolved.imageUrl,
              artistColor: getArtistColor(a.resolved.spotifyId),
              artistInitials: getArtistInitials(a.resolved.name),
            },
          });
          created = true;
          nextSlot++;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            const target = String(e.meta?.target ?? "");
            if (target.includes("spotify")) {
              console.error(`  ✗ ${a.resolved.name}: reivindicado por outro durante o apply`);
              break;
            }
            nextSlot++; // colisão de slot — tenta o próximo índice
            continue;
          }
          throw e;
        }
      }
      if (created) console.log(`  + artista ${a.resolved.name} → @${p.handle}`);
    }
  }

  const totals = await prisma.copaEdition.findUnique({
    where: { id: copa.id },
    include: { _count: { select: { participants: true, copaArtists: true } } },
  });
  console.log(
    `\nFeito. Participantes: ${totals?._count.participants} | Artistas: ${totals?._count.copaArtists}`,
  );
})()
  .catch((e) => {
    console.error("ERR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
