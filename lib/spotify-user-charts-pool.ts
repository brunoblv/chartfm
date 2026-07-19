/**
 * Pool Spotify exclusivo para criação/import de paradas de usuário.
 * Isolado deste arquivo para não puxar `node:async_hooks` ao bundle do cliente
 * (lib/spotify-server.ts é importado por componentes client via lib/copa.ts).
 * Importar só de Route Handlers / Server Components.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { __setSpotifyAppPoolGetter, probeSpotifyApi } from "@/lib/spotify-server";
// Garante o resolvedor de "quem pediu" também quando este módulo carrega (rotas de parada).
import "@/lib/api-call-context";

type SpotifyAppPool = "default" | "user-charts" | "crownnote" | "backfill";

const spotifyPoolStorage = new AsyncLocalStorage<{ pool: SpotifyAppPool }>();

__setSpotifyAppPoolGetter(() => spotifyPoolStorage.getStore()?.pool ?? "default");

/** Escopo para publicação/import de paradas — libera failover no BACKUP2. */
export function runWithSpotifyUserChartsPool<T>(fn: () => Promise<T>): Promise<T> {
  return spotifyPoolStorage.run({ pool: "user-charts" }, fn);
}

/** Escopo da tela /admin/crownnote-export — usa o BACKUP3 dedicado. */
export function runWithSpotifyCrownnotePool<T>(fn: () => Promise<T>): Promise<T> {
  return spotifyPoolStorage.run({ pool: "crownnote" }, fn);
}

/** Escopo de backfills com busca (capas/catálogo) — usa o mesmo BACKUP3 do Crownnote. */
export function runWithSpotifyBackfillPool<T>(fn: () => Promise<T>): Promise<T> {
  return spotifyPoolStorage.run({ pool: "backfill" }, fn);
}

/** Probe no pool de paradas de usuário (principal → backup → BACKUP2). */
export async function probeSpotifyApiForUserCharts() {
  return runWithSpotifyUserChartsPool(() => probeSpotifyApi());
}

/** Probe no pool de backfill (BACKUP3 quando configurado). */
export async function probeSpotifyApiForBackfill() {
  return runWithSpotifyBackfillPool(() => probeSpotifyApi());
}
