#!/bin/bash
# Генерация SSH-ключей для GitHub Actions deploy (запуск на сервере под root)
# bash infra/scripts/setup-ci-ssh-key.sh

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
KEY_PATH="/home/${DEPLOY_USER}/.ssh/github_actions"

if ! id "${DEPLOY_USER}" &>/dev/null; then
  echo "User ${DEPLOY_USER} not found. Run bootstrap-pilot-server.sh first." >&2
  exit 1
fi

mkdir -p "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh"

if [ ! -f "${KEY_PATH}" ]; then
  ssh-keygen -t ed25519 -f "${KEY_PATH}" -N ""
fi

grep -qF "$(cat ${KEY_PATH}.pub)" "/home/${DEPLOY_USER}/.ssh/authorized_keys" 2>/dev/null \
  || cat "${KEY_PATH}.pub" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys" "${KEY_PATH}"
chmod 644 "${KEY_PATH}.pub"

echo ""
echo "=== Add to GitHub Secrets ==="
echo "PILOT_SERVER_HOST=77.91.93.156"
echo "PILOT_SERVER_USER=${DEPLOY_USER}"
echo "PILOT_DOMAIN=teamzachet.ru"
echo ""
echo "PILOT_SERVER_SSH_KEY — copy ONLY the key block below (with line breaks):"
echo "Do NOT include these comment lines or --- markers."
echo ""
cat "${KEY_PATH}"
echo ""
echo "Verify key on server: ssh-keygen -y -f ${KEY_PATH}"
echo "Re-create secret: delete old PILOT_SERVER_SSH_KEY, paste fresh copy from cat above."
