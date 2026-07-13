#!/usr/bin/env bash
# Recalcula o snapshot da Parada de Álbuns de uma única semana, dada uma data.
#
# Uso na VPS:
#   cd /root/chartfm
#   chmod +x scripts/rebuild-album-snapshot-date-vps.sh
#   ./scripts/rebuild-album-snapshot-date-vps.sh 2026-01-15

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec npx tsx scripts/rebuild-album-snapshot-date.ts "$@"
