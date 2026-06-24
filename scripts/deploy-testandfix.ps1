# Подготовка и подсказка по ручному деплою ветки TestAndFix на pilot.
# Использование из корня репозитория:
#   .\scripts\deploy-testandfix.ps1
#   .\scripts\deploy-testandfix.ps1 -Push
#   .\scripts\deploy-testandfix.ps1 -Push -DeployHost root@77.91.93.156

param(
    [switch]$Push,
    [string]$DeployHost = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Backend tests..."
Push-Location backend
python -m pytest tests/ -q --tb=no
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

Write-Host "==> Frontend build..."
Push-Location frontend
npm run build --silent
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

$branch = (git branch --show-current).Trim()
if ($branch -ne "TestAndFix") {
    Write-Warning "Текущая ветка: $branch (ожидалась TestAndFix)"
}

if ($Push) {
    Write-Host "==> git push origin TestAndFix..."
    git push -u origin TestAndFix
}

Write-Host "Готово к ручному деплою на сервере:"
Write-Host "  git push -u origin TestAndFix   # если ещё не запушено"
Write-Host "  ssh root@77.91.93.156"
Write-Host "  cd /opt/teamzachet"
Write-Host "  GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh"
Write-Host ""
Write-Host "С обновлением демо-данных (идемпотентно):"
Write-Host "  RUN_SEED=true GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh"
Write-Host ""
Write-Host "Документация: docs/diagnostics-testandfix.md"

if ($DeployHost) {
    Write-Host "==> SSH deploy to $DeployHost ..."
    ssh $DeployHost "cd /opt/teamzachet && GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh"
}
