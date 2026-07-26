#!/usr/bin/env bash
# Job semanal Disk MTV → Remotion → YouTube (VPS).
# Crontab: domingo 19h America/Sao_Paulo

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${CHARTFM_ENV:-$ROOT/.env}"
LOG_DIR="${ROOT}/logs"
mkdir -p "$LOG_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$ROOT"

# Garante Node do PATH da VPS (nvm/fnm opcional)
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi

export TZ="${TZ:-America/Sao_Paulo}"

echo "[$(date -Is)] videoparada Disk MTV — início" >> "$LOG_DIR/videoparada-disk-mtv.log"

set +e
npx tsx scripts/videoparada-disk-mtv-weekly.ts \
  --format=landscape \
  --limit="${VIDEOPARADA_DISK_MTV_LIMIT:-20}" \
  >> "$LOG_DIR/videoparada-disk-mtv.log" 2>&1
status=$?
set -e

echo "[$(date -Is)] videoparada Disk MTV — fim (exit ${status})" >> "$LOG_DIR/videoparada-disk-mtv.log"
exit "$status"
