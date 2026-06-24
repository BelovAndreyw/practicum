#!/bin/bash
# Ручной деплой pilot с произвольной ветки (по умолчанию TestAndFix).
# Запуск на сервере от root или deploy:
#
#   GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh
#
# Или из /opt/teamzachet после git pull:
#   bash infra/scripts/deploy-pilot-manual.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/teamzachet}"
GIT_BRANCH="${GIT_BRANCH:-TestAndFix}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.pilot.yml}"
ENV_FILE="${ENV_FILE:-.env.pilot}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

cd "${APP_DIR}"

echo "==> Fetch ${GIT_BRANCH}..."
if [ "$(id -un)" = "${DEPLOY_USER}" ]; then
  git fetch origin "${GIT_BRANCH}"
  git checkout "${GIT_BRANCH}"
  git reset --hard "origin/${GIT_BRANCH}"
else
  sudo -u "${DEPLOY_USER}" git fetch origin "${GIT_BRANCH}"
  sudo -u "${DEPLOY_USER}" git checkout "${GIT_BRANCH}"
  sudo -u "${DEPLOY_USER}" git reset --hard "origin/${GIT_BRANCH}"
fi

echo "==> Build and start (${COMPOSE_FILE})..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build --remove-orphans

echo "==> Wait for backend health..."
for i in $(seq 1 36); do
  status="$(docker inspect -f '{{.State.Health.Status}}' tz-pilot-backend 2>/dev/null || echo starting)"
  if [ "${status}" = "healthy" ]; then
    echo "Backend is healthy."
    break
  fi
  if [ "${status}" = "unhealthy" ]; then
    echo "Backend unhealthy — последние логи:"
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" logs --tail=80 backend
    exit 1
  fi
  sleep 5
done

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo ""
  echo "==> Seed (идемпотентный seed_all.py)..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --no-deps \
    -v "${APP_DIR}/scripts:/scripts:ro" \
    -v "${APP_DIR}/backend:/app:ro" \
    backend python /scripts/seed_all.py
fi

echo ""
echo "==> Smoke (локально на сервере):"
echo "  curl -fsS -o /dev/null https://teamzachet.ru/ || curl -fsS -o /dev/null http://127.0.0.1/"
echo "  curl -fsS https://teamzachet.ru/api/ || true"
echo ""
echo "Опционально — обновить демо-данные (идемпотентно):"
echo "  bash scripts/seed_pilot.sh"
echo "  # или: RUN_SEED=true bash infra/scripts/deploy-pilot-manual.sh"
echo ""
echo "Деплой ветки ${GIT_BRANCH} завершён."
