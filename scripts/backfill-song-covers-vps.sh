#!/usr/bin/env bash
# Preenche capas de músicas sem Album.coverUrl (Spotify) no servidor.
#
# Uso na VPS:
#   cd /root/chartfm
#   chmod +x scripts/backfill-song-covers-vps.sh
#   ./scripts/backfill-song-covers-vps.sh --dry-run
#   ./scripts/backfill-song-covers-vps.sh
#   ./scripts/backfill-song-covers-vps.sh --search --delay-ms=5000

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec npx tsx scripts/backfill-song-covers.ts "$@"
