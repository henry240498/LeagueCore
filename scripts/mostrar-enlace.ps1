# Muestra y copia al portapapeles el enlace publico del tunel de Cloudflare de LeagueCore.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mostrar-enlace.ps1 [-Quiet]
param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'process-ownership.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot
$urlFile = Join-Path $projectRoot 'logs\tunnel-url.txt'

$tunnel = @(Get-ProjectStackProcesses -ProjectRoot $projectRoot -WebPort 5173 | Where-Object { $_.Name -ieq 'cloudflared.exe' })
if ($tunnel.Count -gt 0 -and (Test-Path $urlFile)) {
  $url = (Get-Content $urlFile -Raw).Trim()
  try { Set-Clipboard -Value $url } catch { }
  $msg = "Enlace remoto de LeagueCore (copiado al portapapeles):`n`n$url`n`nSirve mientras esta PC siga encendida, con Internet y con LeagueCore abierto."
  $icon = 64
} else {
  $msg = "No hay un tunel activo.`nAbri LeagueCore (acceso directo 'LeagueCore') para iniciarlo."
  $icon = 48
}
Write-Host $msg
if (-not $Quiet) {
  try { (New-Object -ComObject WScript.Shell).Popup($msg, 30, 'LeagueCore', $icon) | Out-Null } catch { }
}
