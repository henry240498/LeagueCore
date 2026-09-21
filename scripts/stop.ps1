# Apaga la pila de LeagueCore (API + Web + tunel de Cloudflare).
# Solo detiene procesos identificados como propios (regla del repo); los ajenos se informan y se respetan.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop.ps1 [-Quiet]
param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'process-ownership.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot

$count = Stop-ProjectStack -ProjectRoot $projectRoot -Ports @(4001, 5173)
Remove-Item -Path (Join-Path $projectRoot 'logs\tunnel-url.txt') -ErrorAction SilentlyContinue

$msg = if ($count -gt 0) { "LeagueCore detenido ($count procesos propios apagados). Puertos 4001 y 5173 liberados." } else { 'LeagueCore no estaba en ejecucion.' }
Write-Host $msg
if (-not $Quiet) {
  try { (New-Object -ComObject WScript.Shell).Popup($msg, 6, 'LeagueCore', 64) | Out-Null } catch { }
}
