#!/bin/bash
# Генерация self-signed TLS сертификата для test-окружения
# Использование: bash infra/ssl/generate-self-signed.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

mkdir -p "$CERTS_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/CN=test.teamzachet.local/O=TeamZachet/C=RU"

echo "Self-signed certificate generated:"
echo "  Certificate: $CERTS_DIR/server.crt"
echo "  Private key: $CERTS_DIR/server.key"
echo ""
echo "For production, replace with a real certificate (e.g., Let's Encrypt)."
