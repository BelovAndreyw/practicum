#!/bin/bash
# Генерация SSH-ключей для GitHub Actions deploy (запуск на сервере под root)
# bash infra/scripts/setup-ci-ssh-key.sh
# Пересоздать ключ: FORCE=1 bash infra/scripts/setup-ci-ssh-key.sh

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
KEY_PATH="/home/${DEPLOY_USER}/.ssh/github_actions"

if ! id "${DEPLOY_USER}" &>/dev/null; then
  echo "User ${DEPLOY_USER} not found. Run bootstrap-pilot-server.sh first." >&2
  exit 1
fi

mkdir -p "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh"

if [ "${FORCE:-0}" = "1" ]; then
  rm -f "${KEY_PATH}" "${KEY_PATH}.pub"
fi

if [ ! -f "${KEY_PATH}" ]; then
  # RSA PEM — максимальная совместимость с GitHub Actions / libcrypto
  ssh-keygen -t rsa -b 4096 -m PEM -f "${KEY_PATH}" -N "" -C "github-actions-deploy"
fi

grep -qF "$(cat "${KEY_PATH}.pub")" "/home/${DEPLOY_USER}/.ssh/authorized_keys" 2>/dev/null \
  || cat "${KEY_PATH}.pub" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys" "${KEY_PATH}"
chmod 644 "${KEY_PATH}.pub"

echo ""
echo "=== GitHub Secrets ==="
echo "PILOT_SERVER_HOST=77.91.93.156"
echo "PILOT_SERVER_USER=${DEPLOY_USER}"
echo "PILOT_DOMAIN=teamzachet.ru"
echo ""
echo "PILOT_SERVER_SSH_KEY — одна строка base64 (без переносов):"
base64 -w0 "${KEY_PATH}"
echo ""
echo ""
echo "Verify: ssh-keygen -y -f ${KEY_PATH}"
echo "Re-create secret: delete PILOT_SERVER_SSH_KEY, paste base64 line above."
