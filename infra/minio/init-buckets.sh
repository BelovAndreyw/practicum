#!/bin/sh
# Инициализация MinIO: создание бакета и настройка доступа

set -e

# Ждём готовности MinIO
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null; do
  echo "Waiting for MinIO..."
  sleep 2
done

echo "MinIO is ready. Configuring..."

# Создаём бакет для загрузок
mc mb local/${MINIO_BUCKET:-uploads} --ignore-existing

# Устанавливаем политику: нет анонимного доступа
mc anonymous set none local/${MINIO_BUCKET:-uploads}

echo "MinIO initialization complete."
echo "  Bucket: ${MINIO_BUCKET:-uploads}"
echo "  Anonymous access: none"
