# Crea accesos directos en el Escritorio para arrancar LeagueCore.
#
#  - "LeagueCore.lnk"          -> start.bat        (arranca TODO: API + Web, abre el navegador)
#  - "LeagueCore (Remoto).lnk" -> start-remote.bat (API + Web + tunel de Cloudflare)
#
# Todos usan el icono leaguecore.ico (generado desde docs/layer-soccer-ball.png).
#
# Uso: click derecho > "Ejecutar con PowerShell", o:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\crear-acceso-directo.ps1

$ErrorActionPreference = 'Stop'

# Raiz del repo = carpeta padre de este script
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')

# Genera el icono si todavia no existe
$icoPath = Join-Path $root 'leaguecore.ico'
if (-not (Test-Path $icoPath)) {
  & (Join-Path $PSScriptRoot 'generar-icono.ps1')
}
$icon = if (Test-Path $icoPath) { $icoPath } else { 'C:\Windows\System32\shell32.dll,137' }

$shell = New-Object -ComObject WScript.Shell

function New-Shortcut {
  param([string]$Name, [string]$Target)
  $path = Join-Path $desktop $Name
  $sc = $shell.CreateShortcut($path)
  $sc.TargetPath = $Target
  $sc.WorkingDirectory = $root
  $sc.IconLocation = $icon
  $sc.Description = 'Arranca LeagueCore'
  $sc.Save()
  Write-Host "Creado: $path" -ForegroundColor Green
}

New-Shortcut -Name 'LeagueCore.lnk'          -Target (Join-Path $root 'start.bat')
New-Shortcut -Name 'LeagueCore (Remoto).lnk' -Target (Join-Path $root 'start-remote.bat')

Write-Host ''
Write-Host 'Listo. Tenes los accesos directos en el Escritorio.' -ForegroundColor Cyan
