/**
 * Pool Spotify exclusivo para criação/import de paradas de usuário.
 * Isolado deste arquivo para não puxar `node:async_hooks` ao bundle do cliente
 * (lib/spotify-server.ts é importado por componentes client via lib/copa.ts).
 * Importar só de Route Handlers / Server Components.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { __setSpotifyAppPoolGetter, probeSpotifyApi } from "@/lib/spotify-server";

type SpotifyAppPool = "default" | "user-charts";

const spotifyPoolStorage = new AsyncLocalStorage<{ pool: SpotifyAppPool }>();

__setSpotifyAppPoolGetter(() => spotifyPoolStorage.getStore()?.pool ?? "default");

/** Escopo para publicação/import de paradas — libera failover no BACKUP2. */
export function runWithSpotifyUserChartsPool<T>(fn: () => Promise<T>): Promise<T> {
  return spotifyPoolStorage.run({ pool: "user-charts" }, fn);
}

/** Probe no pool de paradas de usuário (principal → backup → BACKUP2). */
export async function probeSpotifyApiForUserCharts() {
  return runWithSpotifyUserChartsPool(() => probeSpotifyApi());
}
