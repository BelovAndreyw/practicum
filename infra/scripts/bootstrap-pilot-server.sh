#!/bin/bash
# Одноразовый bootstrap pilot-сервера (teamzachet.ru)
# Запуск от root: bash infra/scripts/bootstrap-pilot-server.sh
#
# Перед запуском:
#   - DNS: teamzachet.ru и www.teamzachet.ru → IP сервера
#   - Docker и docker compose plugin установлены
#   - Репозиторий доступен по SSH (deploy key)

set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:BelovAndreyw/practicum.git}"
APP_DIR="${APP_DIR:-/opt/teamzachet}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
GIT_BRANCH="${GIT_BRANCH:-master}"
DOMAIN="${DOMAIN:-teamzachet.ru}"
WWW_DOMAIN="${WWW_DOMAIN:-www.teamzachet.ru}"
CERT_EMAIL="${CERT_EMAIL:-admin@teamzachet.ru}"

echo "==> Creating deploy user..."
if ! id "${DEPLOY_USER}" &>/dev/null; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

echo "==> Preparing ${APP_DIR}..."
mkdir -p "${APP_DIR}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

DEPLOY_HOME="/home/${DEPLOY_USER}"
DEPLOY_KEY="${DEPLOY_HOME}/.ssh/github_deploy"
mkdir -p "${DEPLOY_HOME}/.ssh"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
chmod 700 "${DEPLOY_HOME}/.ssh"

if [ ! -f "${DEPLOY_KEY}" ]; then
  sudo -u "${DEPLOY_USER}" ssh-keygen -t ed25519 -f "${DEPLOY_KEY}" -N ""
  echo ""
  echo "=== Add this Deploy Key to GitHub (read-only) ==="
  cat "${DEPLOY_KEY}.pub"
  echo "=== Then press Enter to continue ==="
  read -r _
fi

sudo -u "${DEPLOY_USER}" tee "${DEPLOY_HOME}/.ssh/config" >/dev/null <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ${DEPLOY_KEY}
  IdentitiesOnly yes
EOF
chmod 600 "${DEPLOY_HOME}/.ssh/config"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh/config" "${DEPLOY_KEY}"*

if [ ! -d "${APP_DIR}/.git" ]; then
  sudo -u "${DEPLOY_USER}" git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
sudo -u "${DEPLOY_USER}" git fetch origin "${GIT_BRANCH}"
sudo -u "${DEPLOY_USER}" git checkout "${GIT_BRANCH}"
sudo -u "${DEPLOY_USER}" git reset --hard "origin/${GIT_BRANCH}"

echo "==> Creating .env.pilot if missing..."
ENV_FILE="${APP_DIR}/.env.pilot"
if [ ! -f "${ENV_FILE}" ]; then
  PG_PASS="$(openssl rand -hex 32)"
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > "${ENV_FILE}" <<EOF
POSTGRES_USER=teamzachet
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=teamzachet
DATABASE_URL=postgresql+asyncpg://teamzachet:${PG_PASS}@postgres:5432/teamzachet

SECRET_KEY=${JWT_SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEMO_MODE=false

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
EOF
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "Created ${ENV_FILE} with random secrets."
else
  echo "${ENV_FILE} already exists, skipping."
fi

echo "==> Installing certbot..."
apt-get update -qq
apt-get install -y -qq certbot

mkdir -p "${APP_DIR}/infra/ssl/certbot-webroot" "${APP_DIR}/infra/ssl/certs"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/infra/ssl"

echo "==> Obtaining Let's Encrypt certificate..."
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  docker rm -f acme-nginx 2>/dev/null || true
  docker run -d --name acme-nginx -p 80:80 \
    -v "${APP_DIR}/infra/ssl/certbot-webroot:/var/www/certbot" \
    -v "${APP_DIR}/infra/ssl/acme-nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    nginx:1.25-alpine

  certbot certonly --webroot \
    -w "${APP_DIR}/infra/ssl/certbot-webroot" \
    -d "${DOMAIN}" -d "${WWW_DOMAIN}" \
    --email "${CERT_EMAIL}" --agree-tos --no-eff-email

  docker stop acme-nginx && docker rm acme-nginx
fi

cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${APP_DIR}/infra/ssl/certs/server.crt"
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${APP_DIR}/infra/ssl/certs/server.key"
chmod 644 "${APP_DIR}/infra/ssl/certs/server.crt"
chmod 600 "${APP_DIR}/infra/ssl/certs/server.key"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/infra/ssl/certs/"*

echo "==> Setting up cert renewal cron..."
CRON_LINE="0 3 * * * ${APP_DIR}/infra/ssl/renew-letsencrypt.sh >> /var/log/teamzachet-cert-renew.log 2>&1"
(chmod +x "${APP_DIR}/infra/ssl/renew-letsencrypt.sh")
(crontab -l 2>/dev/null | grep -Fv "renew-letsencrypt.sh"; echo "${CRON_LINE}") | crontab -

echo "==> Starting pilot stack..."
cd "${APP_DIR}"
sudo -u "${DEPLOY_USER}" docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot up -d --build

echo "==> Done. Verify:"
echo "  curl -I https://${DOMAIN}/"
echo "  curl -s https://${DOMAIN}/api/"
echo ""
echo "Next: bash ${APP_DIR}/infra/scripts/setup-ci-ssh-key.sh"
echo "      Add secrets per docs/pilot-github-setup.md"
