# Идемпотентное наполнение pilot-БД (seed_all.py внутри backend-контейнера).
# Использование из корня репозитория:
#   .\scripts\seed_pilot.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$EnvFile = if ($env:ENV_FILE) { $env:ENV_FILE } else { ".env.pilot" }
$ComposeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "infra/docker-compose.pilot.yml" }

if (-not (Test-Path $EnvFile)) {
    Write-Error "Не найден $EnvFile. Скопируйте из .env.pilot.example."
}

# Не монтируем backend в /app:ro — uploads-pilot:/app/uploads конфликтует с read-only /app.
docker compose -f $ComposeFile --env-file $EnvFile run --rm --no-deps `
    -v "${Root}/scripts:/scripts:ro" `
    backend python /scripts/seed_all.py
