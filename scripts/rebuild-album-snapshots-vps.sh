#!/usr/bin/env bash
# Recalcula todos os snapshots Global 100 Álbuns de 2026+ no servidor (sem timeout de gateway).
#
# Uso na VPS:
#   cd /root/chartfm
#   chmod +x scripts/rebuild-album-snapshots-vps.sh
#   ./scripts/rebuild-album-snapshots-vps.sh
#   ./scripts/rebuild-album-snapshots-vps.sh --from=202610
#   ./scripts/rebuild-album-snapshots-vps.sh --dry-run

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec npx tsx scripts/rebuild-album-snapshots.ts "$@"
