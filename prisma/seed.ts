/**
 * Seed de desenvolvimento — usuários demo, paradas e snapshot global.
 *
 * Uso:
 *   npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { COVER_PALETTES, SONG_POOL } from "../lib/data";
import { getRankingWeekReference } from "../lib/chart-week";
import { saveGlobalSnapshotForWeek } from "../lib/global-snapshot";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const prisma = new PrismaClient();

const DEV_USERS = [
  { handle: "helenasilva", name: "Helena Silva", avatarColor: "#8338EC", verified: true },
  { handle: "marcosribeiro", name: "Marcos Ribeiro", avatarColor: "#4ECDC4", verified: false },
  { handle: "sophiacarvalho", name: "Sofia Carvalho", avatarColor: "#FF6B6B", verified: false },
] as const;

function coverForSong(title: string, artist: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const palette = COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
  return { paletteA: palette[0], paletteB: palette[1], seed: Math.abs(hash) };
}

function rotate<T>(items: T[], offset: number): T[] {
  const n = items.length;
  if (n === 0) return items;
  const k = ((offset % n) + n) % n;
  return [...items.slice(k), ...items.slice(0, k)];
}

async function main() {
  const { weekIndex, weekLabel, dateRange } = getRankingWeekReference();
  const pool = SONG_POOL.slice(0, 20);

  const songRows = await Promise.all(
    pool.map((song) =>
      prisma.song.upsert({
        where: { title_artist: { title: song.title, artist: song.artist } },
        create: { title: song.title, artist: song.artist, album: song.album ?? null },
        update: {},
      }),
    ),
  );

  const handles = DEV_USERS.map((u) => u.handle);
  await prisma.chart.deleteMany({ where: { user: { handle: { in: [...handles] } } } });

  for (let u = 0; u < DEV_USERS.length; u++) {
    const spec = DEV_USERS[u];
    const user = await prisma.user.upsert({
      where: { handle: spec.handle },
      create: {
        handle: spec.handle,
        name: spec.name,
        avatarColor: spec.avatarColor,
        verified: spec.verified,
        paradaNome: "Parada",
        genres: ["pop"],
      },
      update: {
        name: spec.name,
        avatarColor: spec.avatarColor,
        verified: spec.verified,
      },
    });

    const parada = await prisma.parada.upsert({
      where: { userId_sortOrder: { userId: user.id, sortOrder: 0 } },
      create: {
        userId: user.id,
        name: "Parada",
        isPrimary: true,
        sortOrder: 0,
        chartSize: 100,
      },
      update: {},
    });

    const orderedSongs = rotate(songRows, u * 3);

    await prisma.chart.create({
      data: {
        userId: user.id,
        paradaId: parada.id,
        weekIndex,
        weekLabel,
        dateRange,
        isPublished: true,
        maxItems: 100,
        entries: {
          create: orderedSongs.slice(0, 15).map((song, i) => {
            const cover = coverForSong(song.title, song.artist);
            return {
              songId: song.id,
              position: i + 1,
              points: 100 - i,
              status: i < 2 ? "new" : "up",
              delta: i < 2 ? null : 1,
              peak: i + 1,
              weeks: 1,
              coverPaletteA: cover.paletteA,
              coverPaletteB: cover.paletteB,
              coverSeed: cover.seed,
            };
          }),
        },
      },
    });
  }

  await saveGlobalSnapshotForWeek(weekIndex, { skipDeadline: true });

  console.log(`Seed concluído: ${DEV_USERS.length} usuários, semana ${weekIndex} (${weekLabel}).`);
  console.log("Perfis: @helenasilva, @marcosribeiro, @sophiacarvalho");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
