#!/usr/bin/env bash
# Идемпотентное наполнение pilot-БД (seed_all.py внутри backend-контейнера).
# На сервере из /opt/teamzachet:
#   bash scripts/seed_pilot.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.pilot}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.pilot.yml}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Не найден ${ENV_FILE}. Скопируйте из .env.pilot.example." >&2
  exit 1
fi

# Не монтируем backend в /app:ro — в pilot-compose есть uploads-pilot:/app/uploads,
# и read-only overlay не даёт создать mountpoint для вложенного volume.
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --no-deps \
  -v "${ROOT}/scripts:/scripts:ro" \
  backend python /scripts/seed_all.py
