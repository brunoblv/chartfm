# Copia o banco de PRODUÇÃO (túnel localhost:5434) para o banco DEV (container postgres-local, :5433).
# ⚠️ SUBSTITUI o banco dev "chartfm" inteiro. Prod é apenas LIDO (pg_dump).
# Pré-requisitos: túnel SSH aberto no 5434; dev server (npm run dev) parado.
# Uso:  powershell -File scripts\copy-prod-to-dev.ps1

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\.env"

$prodUrl = (Get-Content $envFile | Where-Object { $_ -match '^PRODUCTION_DATABASE_URL=' }) -replace '^PRODUCTION_DATABASE_URL=', '' -replace '"', ''
$devUrl  = (Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '' -replace '"', ''
if (-not ($prodUrl -match 'postgresql://([^:]+):([^@]+)@[^:/]+:(\d+)/([^?]+)')) { throw "PRODUCTION_DATABASE_URL fora do padrão" }
$prodUser = $Matches[1]; $prodPw = $Matches[2]; $prodPort = $Matches[3]; $prodDb = $Matches[4]
if (-not ($devUrl -match 'postgresql://([^:]+):([^@]+)@[^:/]+:\d+/([^?]+)')) { throw "DATABASE_URL fora do padrão" }
$devUser = $Matches[1]; $devPw = $Matches[2]; $devDb = $Matches[3]

Write-Host "1/4 Dump de produção (pode levar alguns minutos)..." -ForegroundColor Cyan
docker exec -e PGPASSWORD=$prodPw postgres-local pg_dump -h host.docker.internal -p $prodPort -U $prodUser -d $prodDb -Fc --no-owner --no-acl -f /tmp/prod.dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou" }
docker exec postgres-local ls -lh /tmp/prod.dump

Write-Host "2/4 Recriando o banco dev '$devDb' (dados atuais serão perdidos)..." -ForegroundColor Cyan
docker exec -e PGPASSWORD=$devPw postgres-local psql -U $devUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$devDb' AND pid <> pg_backend_pid()"
docker exec -e PGPASSWORD=$devPw postgres-local psql -U $devUser -d postgres -c "DROP DATABASE IF EXISTS $devDb"
docker exec -e PGPASSWORD=$devPw postgres-local psql -U $devUser -d postgres -c "CREATE DATABASE $devDb"
if ($LASTEXITCODE -ne 0) { throw "recriação do banco dev falhou" }

Write-Host "3/4 Restaurando o dump no dev..." -ForegroundColor Cyan
docker exec -e PGPASSWORD=$devPw postgres-local pg_restore --no-owner --no-acl -U $devUser -d $devDb /tmp/prod.dump
# pg_restore pode sair com warnings não-fatais (extensões/comentários); seguimos.

Write-Host "4/4 prisma db push (recria tabelas que só existem no dev: retrô, Momentos Hub...)..." -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "..")
npx prisma db push

docker exec postgres-local rm -f /tmp/prod.dump
Write-Host "Concluído! Banco dev agora é uma cópia de prod + schema novo aplicado." -ForegroundColor Green
