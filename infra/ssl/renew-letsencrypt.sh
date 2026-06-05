#!/bin/bash
# Обновление Let's Encrypt сертификата для teamzachet.ru + www.teamzachet.ru
# Использование: bash infra/ssl/renew-letsencrypt.sh
# Cron (root): 0 3 * * * /opt/teamzachet/infra/ssl/renew-letsencrypt.sh >> /var/log/teamzachet-cert-renew.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WEBROOT="${SCRIPT_DIR}/certbot-webroot"
CERTS_DIR="${SCRIPT_DIR}/certs"
LE_DIR="/etc/letsencrypt/live/teamzachet.ru"
NGINX_CONTAINER="tz-pilot-nginx"

mkdir -p "${WEBROOT}" "${CERTS_DIR}"

certbot renew --quiet --webroot -w "${WEBROOT}"

cp "${LE_DIR}/fullchain.pem" "${CERTS_DIR}/server.crt"
cp "${LE_DIR}/privkey.pem" "${CERTS_DIR}/server.key"
chmod 644 "${CERTS_DIR}/server.crt"
chmod 600 "${CERTS_DIR}/server.key"

if docker ps --format '{{.Names}}' | grep -qx "${NGINX_CONTAINER}"; then
  docker exec "${NGINX_CONTAINER}" nginx -s reload
  echo "$(date -Is) Certificate renewed and nginx reloaded."
else
  echo "$(date -Is) Certificate renewed (nginx container not running)."
fi
