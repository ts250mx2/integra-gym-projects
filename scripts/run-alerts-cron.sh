#!/usr/bin/env bash
# =====================================================================
#  scripts/run-alerts-cron.sh
#  Dispara el cron de alertas (para crontab de Linux). Envía solo las
#  alertas cuya hora ya llegó (22:30 por default), con dedupe diario.
#
#  Variables de entorno:
#    ALERTS_CRON_SECRET   (obligatoria)  — mismo valor que en el .env
#    ALERTS_BASE_URL      (opcional)     — default http://localhost:3010
#
#  Uso:
#    ALERTS_CRON_SECRET=xxx ALERTS_BASE_URL=https://tu-dominio ./run-alerts-cron.sh
#    ./run-alerts-cron.sh --force        # envía TODAS, ignora la hora (probar)
# =====================================================================
set -euo pipefail

BASE_URL="${ALERTS_BASE_URL:-http://localhost:3010}"
KEY="${ALERTS_CRON_SECRET:-}"

if [ -z "$KEY" ]; then
  echo "Falta ALERTS_CRON_SECRET en el entorno." >&2
  exit 1
fi

URL="${BASE_URL%/}/api/cron/run-alerts?key=${KEY}"
if [ "${1:-}" = "--force" ] || [ "${1:-}" = "-f" ]; then
  URL="${URL}&force=1"
fi

LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/logs"
mkdir -p "$LOG_DIR"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"
RESP="$(curl -s -m 290 "$URL" || echo '{"error":"curl failed"}')"

echo "[$STAMP] $RESP" | tee -a "$LOG_DIR/alerts-cron.log"
