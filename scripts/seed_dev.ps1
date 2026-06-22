# Запуск seed_all.py внутри backend-контейнера (надёжно на Windows + Docker).
# Использование из корня репозитория:
#   .\scripts\seed_dev.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env")) {
    Write-Error "Не найден .env в $Root. Скопируйте из .env.example и задайте POSTGRES_*."
}

docker compose -f infra/docker-compose.dev.yml --env-file .env run --rm --no-deps `
    -v "${Root}/scripts:/scripts:ro" `
    -v "${Root}/backend:/app:ro" `
    backend python /scripts/seed_all.py
