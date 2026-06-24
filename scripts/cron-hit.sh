#!/usr/bin/env bash
# Chama um endpoint GET /api/cron/* (uso na VPS).
# Variáveis: CRON_SECRET, APP_BASE_URL (opcional, padrão http://127.0.0.1:3000)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${CHARTFM_ENV:-$ROOT/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

endpoint="${1:-}"
if [[ -z "$endpoint" || "$endpoint" != /* ]]; then
  echo "Uso: $0 /api/cron/nome" >&2
  exit 1
fi

base="${APP_BASE_URL:-http://127.0.0.1:3000}"
url="${base%/}${endpoint}"

auth=()
if [[ -n "${CRON_SECRET:-}" ]]; then
  auth=(-H "Authorization: Bearer ${CRON_SECRET}")
fi

exec curl -fsS "${auth[@]}" "$url"
