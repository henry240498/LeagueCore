# Crea los accesos directos de LeagueCore en el Escritorio de ESTE equipo y verifica los requisitos.
#
# Los .lnk guardan rutas absolutas, por eso NO se versionan en el repo: cada equipo los genera
# apuntando a la carpeta donde esta clonado LeagueCore. Ejecutar una vez por equipo (o de nuevo
# si se mueve la carpeta): doble clic en "Instalar accesos directos.bat".
#
#  - LeagueCore                      -> start.bat        (API + Web + tunel de Cloudflare, oculto)
#  - LeagueCore (solo local)         -> start-local.bat  (API + Web, SIN tunel)
#  - LeagueCore (detener)            -> stop.bat         (apaga todo lo propio)
#  - LeagueCore (enlace remoto)      -> enlace-remoto.bat (muestra/copia la URL publica del tunel)
#
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\crear-acceso-directo.ps1 [-NoPrompt]
#   -NoPrompt  no hace preguntas (no ofrece instalar cloudflared); para automatizacion

param([switch]$NoPrompt)

$ErrorActionPreference = 'Stop'

# Raiz del repo = carpeta padre de este script (nada de rutas fijas)
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')

Write-Host "Carpeta de LeagueCore: $root" -ForegroundColor Cyan
Write-Host "Escritorio:            $desktop" -ForegroundColor Cyan
Write-Host ''

# --- Requisitos -----------------------------------------------------------------------------
Write-Host 'Verificando requisitos...' -ForegroundColor Cyan

if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "  [ok] Node.js $(node -v)" -ForegroundColor Green
} else {
  Write-Host '  [!!] Falta Node.js. Instalalo desde https://nodejs.org (version LTS) antes de usar LeagueCore.' -ForegroundColor Yellow
}

$beEnv = Join-Path $root 'src\backend\.env'
if (Test-Path $beEnv) {
  Write-Host '  [ok] src\backend\.env existe' -ForegroundColor Green
} else {
  Write-Host '  [!!] Falta src\backend\.env. Al abrir LeagueCore por primera vez se crea desde .env.example;' -ForegroundColor Yellow
  Write-Host '       completalo con los datos de tu SQL Server (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) y un JWT_SECRET.' -ForegroundColor Yellow
}

function Find-Cloudflared {
  $c = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($x in @('C:\Program Files (x86)\cloudflared\cloudflared.exe', 'C:\Program Files\cloudflared\cloudflared.exe', (Join-Path $root 'tools\cloudflared.exe'))) {
    if (Test-Path $x) { return $x }
  }
  if ($env:LOCALAPPDATA) {
    $wg = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wg) {
      $f = Get-ChildItem -Path $wg -Filter cloudflared.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($f) { return $f.FullName }
    }
  }
  return $null
}

if (Find-Cloudflared) {
  Write-Host '  [ok] cloudflared (tunel de acceso remoto)' -ForegroundColor Green
} else {
  Write-Host '  [!!] Falta cloudflared (necesario para el acceso remoto; sin el, LeagueCore funciona solo en local).' -ForegroundColor Yellow
  if (-not $NoPrompt -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    $answer = Read-Host '       Instalarlo ahora con winget (Cloudflare.cloudflared)? [S/N]'
    if ($answer -match '^(s|y)') {
      winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
      if (Find-Cloudflared) { Write-Host '  [ok] cloudflared instalado' -ForegroundColor Green }
      else { Write-Host '  [!!] No se pudo verificar la instalacion. Reintenta luego con: winget install --id Cloudflare.cloudflared' -ForegroundColor Yellow }
    }
  } elseif (-not $NoPrompt) {
    Write-Host '       Instalalo desde https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/' -ForegroundColor Yellow
  }
}
Write-Host ''

# --- Icono ----------------------------------------------------------------------------------
$icoPath = Join-Path $root 'leaguecore.ico'
if (-not (Test-Path $icoPath)) {
  & (Join-Path $PSScriptRoot 'generar-icono.ps1')
}
$icon = if (Test-Path $icoPath) { "$icoPath,0" } else { 'C:\Windows\System32\shell32.dll,137' }

# --- Accesos directos -----------------------------------------------------------------------
$shell = New-Object -ComObject WScript.Shell

function New-Shortcut {
  param([string]$Name, [string]$TargetFile, [string]$Description)
  $target = Join-Path $root $TargetFile
  if (-not (Test-Path $target)) { throw "No existe $target" }
  $path = Join-Path $desktop "$Name.lnk"
  $sc = $shell.CreateShortcut($path)
  $sc.TargetPath = $target
  $sc.WorkingDirectory = $root
  $sc.IconLocation = $icon
  $sc.Description = $Description
  $sc.WindowStyle = 7   # minimizada: el .bat delega en un proceso oculto y termina enseguida
  $sc.Save()
  Write-Host "  Creado: $path" -ForegroundColor Green
}

# Accesos de una version anterior que ya no existen (apuntaban a start-remote.bat): se quitan solo
# si realmente apuntan a este repo, para no borrar nada ajeno.
$oldRemote = Join-Path $desktop 'LeagueCore (Remoto).lnk'
if (Test-Path $oldRemote) {
  try {
    $old = $shell.CreateShortcut($oldRemote)
    if ($old.TargetPath -match 'start-remote\.bat$') {
      Remove-Item -Path $oldRemote
      Write-Host '  Quitado el acceso obsoleto "LeagueCore (Remoto)" (el tunel ahora arranca con LeagueCore).' -ForegroundColor DarkGray
    }
  } catch { }
}

Write-Host 'Creando accesos directos...' -ForegroundColor Cyan
New-Shortcut -Name 'LeagueCore' -TargetFile 'start.bat' -Description 'Arranca LeagueCore (API + Web + acceso remoto)'
New-Shortcut -Name 'LeagueCore (solo local)' -TargetFile 'start-local.bat' -Description 'Arranca LeagueCore solo en esta PC, sin tunel'
New-Shortcut -Name 'LeagueCore (detener)' -TargetFile 'stop.bat' -Description 'Apaga LeagueCore (API, Web y tunel)'
New-Shortcut -Name 'LeagueCore (enlace remoto)' -TargetFile 'enlace-remoto.bat' -Description 'Muestra y copia el enlace publico del tunel'

Write-Host ''
Write-Host 'Listo. Tenes los accesos directos en el Escritorio.' -ForegroundColor Cyan
Write-Host "Se crearon apuntando a: $root" -ForegroundColor DarkGray
