#!/usr/bin/env bash
# Запуск seed_all.py внутри backend-контейнера.
# Использование из корня репозитория: bash scripts/seed_dev.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Не найден .env. Скопируйте из .env.example." >&2
  exit 1
fi

docker compose -f infra/docker-compose.dev.yml --env-file .env run --rm --no-deps \
  -v "${ROOT}/scripts:/scripts:ro" \
  -v "${ROOT}/backend:/app:ro" \
  backend python /scripts/seed_all.py
