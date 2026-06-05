#!/bin/bash
# Р“РµРЅРµСЂР°С†РёСЏ self-signed TLS СЃРµСЂС‚РёС„РёРєР°С‚Р°.
#
# РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:
#   bash infra/ssl/generate-self-signed.sh            # test (CN=test.teamzachet.local)
#   bash infra/ssl/generate-self-signed.sh pilot      # pilot (CN=pilot.teamzachet.local + SAN РЅР° localhost)
#
# РЎРµСЂС‚РёС„РёРєР°С‚ РІСЃРµРіРґР° РєР»Р°РґС‘С‚СЃСЏ РІ infra/ssl/certs/{server.crt,server.key},
# РїРѕС‚РѕРјСѓ С‡С‚Рѕ compose-С„Р°Р№Р»С‹ РјРѕРЅС‚РёСЂСѓСЋС‚ СЌС‚РѕС‚ РєР°С‚Р°Р»РѕРі РєР°Рє :ro.

set -e

ENV_NAME="${1:-test}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

case "$ENV_NAME" in
  test)
    CN="test.teamzachet.local"
    SAN="DNS:test.teamzachet.local,DNS:localhost,IP:127.0.0.1"
    ;;
  pilot)
    CN="pilot.teamzachet.local"
    SAN="DNS:pilot.teamzachet.local,DNS:localhost,IP:127.0.0.1"
    ;;
  *)
    echo "Unknown env: $ENV_NAME (expected: test | pilot)" >&2
    exit 1
    ;;
esac

mkdir -p "$CERTS_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/CN=${CN}/O=TeamZachet/C=RU" \
  -addext "subjectAltName=${SAN}"

echo "Self-signed certificate generated for [$ENV_NAME]:"
echo "  CN:          $CN"
echo "  SAN:         $SAN"
echo "  Certificate: $CERTS_DIR/server.crt"
echo "  Private key: $CERTS_DIR/server.key"
echo ""
echo "РќР° СЃРµСЂРІРµСЂРµ Р·Р°РјРµРЅРё РЅР° СЂРµР°Р»СЊРЅС‹Р№ СЃРµСЂС‚РёС„РёРєР°С‚ (Let's Encrypt)."
