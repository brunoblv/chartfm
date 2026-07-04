/**
 * Gera SQL para importar o histórico UCC em produção.
 *
 * Resolve IDs de comunidade/usuário/parada por slug/handle e músicas por spotify_id
 * (fallback: title + artist). Mantém week_index como chave natural dos charts.
 *
 * Usage:
 *   npx tsx scripts/export-ucc-prod-sql.ts
 *   npx tsx scripts/export-ucc-prod-sql.ts --out=scripts/ucc-prod-import.sql
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

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

const COMMUNITY_SLUG = "hit-parade-paradas-pessoais-ucc";

const OUT_ARG = process.argv.find((a) => a.startsWith("--out="));
const OUT_PATH = OUT_ARG
  ? OUT_ARG.split("=").slice(1).join("=")
  : join(process.cwd(), "scripts", "ucc-prod-import.sql");

function sqlStr(value: string | null | undefined): string {
  if (value == null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlInt(value: number | null | undefined): string {
  if (value == null) return "NULL";
  return String(value);
}

function sqlTs(value: Date): string {
  return `'${value.toISOString().replace("T", " ").replace("Z", "+00")}'::timestamptz`;
}

function sqlDate(value: Date | null | undefined): string {
  if (!value) return "NULL";
  return `'${value.toISOString().slice(0, 10)}'::date`;
}

function songLookupSql(spotifyId: string | null, title: string, artist: string): string {
  if (spotifyId) {
    return `(SELECT id FROM "Song" WHERE spotify_id = ${sqlStr(spotifyId)} LIMIT 1)`;
  }
  return `(SELECT id FROM "Song" WHERE lower(title) = lower(${sqlStr(title)}) AND lower(artist) = lower(${sqlStr(artist)}) LIMIT 1)`;
}

async function main() {
  const community = await prisma.community.findUnique({
    where: { slug: COMMUNITY_SLUG },
    select: { id: true, paradaName: true, ownerId: true, maxSongs: true },
  });
  if (!community) throw new Error(`Comunidade ${COMMUNITY_SLUG} não encontrada no banco local.`);
  if (!community.ownerId) throw new Error(`Comunidade ${COMMUNITY_SLUG} sem owner.`);

  const owner = await prisma.user.findUnique({
    where: { id: community.ownerId },
    select: { id: true, handle: true },
  });
  if (!owner) throw new Error(`Owner da comunidade não encontrado.`);

  const parada = await prisma.parada.findFirst({
    where: {
      userId: owner.id,
      name: { equals: community.paradaName, mode: "insensitive" },
    },
    select: { id: true, name: true, chartSize: true, sortOrder: true },
  });
  if (!parada) throw new Error(`Parada "${community.paradaName}" não encontrada.`);

  const charts = await prisma.chart.findMany({
    where: { communityId: community.id, paradaId: parada.id },
    orderBy: { weekIndex: "asc" },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: {
          song: { select: { title: true, artist: true, spotifyId: true } },
        },
      },
    },
  });

  if (!charts.length) throw new Error("Nenhum chart UCC encontrado para exportar.");

  const lines: string[] = [
    "-- Importação histórico UCC (United Community Chart)",
    `-- Gerado em ${new Date().toISOString()}`,
    `-- Charts: ${charts.length} | Entradas: ${charts.reduce((n, c) => n + c.entries.length, 0)}`,
    "--",
    "-- Cenário: importação limpa em prod (sem migração de parada errada).",
    "-- Não mexe nas paradas pessoais do owner (ex.: Top Hits); só charts com community_id desta comunidade.",
    "--",
    "-- Pré-requisitos em prod:",
    `--   comunidade slug = ${COMMUNITY_SLUG}`,
    `--   owner = @${owner.handle} (via Community.ownerId)`,
    `--   parada oficial = "${community.paradaName}" (via Community.paradaName; cria se não existir)`,
    "--   músicas resolvíveis por spotify_id (ou title+artist)",
    "--",
    "BEGIN;",
    "",
    "-- Variáveis de contexto (slug/handle funcionam em prod mesmo com IDs diferentes)",
    "DO $$",
    "DECLARE",
    "  v_community_id TEXT;",
    "  v_user_id TEXT;",
    "  v_parada_id TEXT;",
    "  v_parada_name TEXT;",
    "  v_chart_size INT;",
    "BEGIN",
    `  SELECT id, "ownerId", "paradaName", "maxSongs"`,
    "  INTO v_community_id, v_user_id, v_parada_name, v_chart_size",
    `  FROM "Community" WHERE slug = ${sqlStr(COMMUNITY_SLUG)} LIMIT 1;`,
    "  IF v_community_id IS NULL THEN",
    `    RAISE EXCEPTION 'Comunidade ${COMMUNITY_SLUG} não encontrada em prod';`,
    "  END IF;",
    "  IF v_user_id IS NULL THEN",
    "    RAISE EXCEPTION 'Comunidade sem owner em prod';",
    "  END IF;",
    "",
    "  SELECT id INTO v_parada_id",
    "  FROM paradas",
    "  WHERE user_id = v_user_id",
    "    AND lower(name) = lower(v_parada_name)",
    "    AND deleted_at IS NULL",
    "  LIMIT 1;",
    "",
    "  IF v_parada_id IS NULL THEN",
    "    INSERT INTO paradas (id, user_id, name, genres, is_primary, sort_order, chart_size, cadence, created_at, updated_at)",
    "    VALUES (",
    "      gen_random_uuid()::text,",
    "      v_user_id,",
    "      v_parada_name,",
    "      ARRAY['Pop']::text[],",
    "      false,",
    "      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM paradas WHERE user_id = v_user_id),",
    "      COALESCE(v_chart_size, 20),",
    "      'WEEKLY'::\"ParadaCadence\",",
    "      NOW(),",
    "      NOW()",
    "    )",
    "    RETURNING id INTO v_parada_id;",
    "  END IF;",
    "",
    "  CREATE TEMP TABLE IF NOT EXISTS _ucc_ctx (community_id TEXT, user_id TEXT, parada_id TEXT);",
    "  DELETE FROM _ucc_ctx;",
    "  INSERT INTO _ucc_ctx VALUES (v_community_id, v_user_id, v_parada_id);",
    "END $$;",
    "",
    "-- Remove charts UCC anteriores (reimportação idempotente)",
    'DELETE FROM "ChartEntry"',
    'WHERE "chartId" IN (',
    '  SELECT c.id FROM "Chart" c',
    "  JOIN _ucc_ctx ctx ON c.community_id = ctx.community_id",
    ");",
    "",
    'DELETE FROM "Chart"',
    "WHERE id IN (",
    '  SELECT c.id FROM "Chart" c',
    "  JOIN _ucc_ctx ctx ON c.community_id = ctx.community_id",
    ");",
    "",
  ];

  for (const chart of charts) {
    const chartId = chart.id;
    lines.push(`-- Semana ${chart.weekIndex} (${chart.dateRange})`);
    lines.push('INSERT INTO "Chart" (');
    lines.push(
      '  id, "userId", parada_id, "weekIndex", "weekLabel", "dateRange", "publishedAt", "postedAt",',
      "  likes, comments, reposts, chart_type, week_start_date, is_published, max_items, community_id",
      ")",
    );
    lines.push("SELECT");
    lines.push(`  ${sqlStr(chartId)},`);
    lines.push("  ctx.user_id,");
    lines.push("  ctx.parada_id,");
    lines.push(`  ${chart.weekIndex},`);
    lines.push(`  ${sqlStr(chart.weekLabel)},`);
    lines.push(`  ${sqlStr(chart.dateRange)},`);
    lines.push(`  ${sqlTs(chart.publishedAt)},`);
    lines.push(`  ${sqlTs(chart.postedAt)},`);
    lines.push(`  ${chart.likes}, ${chart.comments}, ${chart.reposts},`);
    lines.push(`  'SONGS',`);
    lines.push(`  ${sqlDate(chart.weekStartDate)},`);
    lines.push(`  ${chart.isPublished},`);
    lines.push(`  ${chart.maxItems},`);
    lines.push("  ctx.community_id");
    lines.push("FROM _ucc_ctx ctx");
    lines.push(
      'WHERE NOT EXISTS (SELECT 1 FROM "Chart" c WHERE c.parada_id = ctx.parada_id AND c."weekIndex" = ' +
        chart.weekIndex +
        ");",
    );
    lines.push("");

    for (const entry of chart.entries) {
      const songSql = songLookupSql(
        entry.song.spotifyId,
        entry.song.title,
        entry.song.artist,
      );
      lines.push('INSERT INTO "ChartEntry" (');
      lines.push(
        '  id, "chartId", "songId", position, points, created_at, song_spotify_id, album_spotify_id,',
        '  status, delta, "prevPos", peak, weeks, "coverPaletteA", "coverPaletteB", "coverSeed"',
        ")",
      );
      lines.push("SELECT");
      lines.push(`  ${sqlStr(entry.id)},`);
      lines.push(`  ${sqlStr(chartId)},`);
      lines.push(`  ${songSql},`);
      lines.push(`  ${entry.position}, ${entry.points}, ${sqlTs(entry.createdAt)},`);
      lines.push(`  ${sqlStr(entry.songSpotifyId)}, ${sqlStr(entry.albumSpotifyId)},`);
      lines.push(`  ${sqlStr(entry.status)}, ${sqlInt(entry.delta)}, ${sqlInt(entry.prevPos)},`);
      lines.push(`  ${entry.peak}, ${entry.weeks},`);
      lines.push(`  ${sqlStr(entry.coverPaletteA)}, ${sqlStr(entry.coverPaletteB)}, ${entry.coverSeed}`);
      lines.push(`WHERE ${songSql} IS NOT NULL`);
      lines.push(
        '  AND NOT EXISTS (SELECT 1 FROM "ChartEntry" ce WHERE ce."chartId" = ' +
          sqlStr(chartId) +
          " AND ce.position = " +
          entry.position +
          ");",
      );
      lines.push("");
    }
  }

  lines.push("DROP TABLE IF EXISTS _ucc_ctx;");
  lines.push("COMMIT;");
  lines.push("");

  writeFileSync(OUT_PATH, lines.join("\n"), "utf-8");
  console.log(`[ok] SQL gerado: ${OUT_PATH}`);
  console.log(`[info] ${charts.length} charts, ${charts.reduce((n, c) => n + c.entries.length, 0)} entradas`);
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
