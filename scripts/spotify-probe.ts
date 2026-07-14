/**
 * Testa rapidamente se a API do Spotify está respondendo (ou ainda em 429).
 *
 * Usage:
 *   npx tsx scripts/spotify-probe.ts
 */

import { existsSync, readFileSync } from "fs";
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

import { probeSpotifyApi } from "../lib/spotify-server";

probeSpotifyApi().then((r) => {
  console.log(r);
  if (r.ok) {
    console.log("Spotify OK — sem rate limit.");
  } else if (r.status === 429) {
    const secs = r.retryAfterMs != null ? Math.ceil(r.retryAfterMs / 1000) : null;
    console.log(
      secs != null
        ? `Ainda em 429 — Spotify pediu para esperar ${secs}s (~${Math.ceil(secs / 60)}min).`
        : "Ainda em 429 — Spotify não informou Retry-After.",
    );
  } else {
    console.log(`Falha não relacionada a rate limit: ${r.error}`);
  }
});
