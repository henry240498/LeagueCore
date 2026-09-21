# Levanta LeagueCore (API + Web) y crea un tunel de Cloudflare para acceso remoto.
#
# - Backend y frontend arrancan ocultos (logs en logs\backend.log y logs\frontend.log).
# - El frontend se levanta con VITE_API_URL=/api/v1 para que, a traves del tunel, todo
#   pase por un unico origen (el proxy de Vite reenvia /api y /uploads al backend local).
# - cloudflared abre una URL publica https temporal (*.trycloudflare.com) y la muestra
#   en esta ventana. Cerra esta ventana o Ctrl+C para bajar SOLO el tunel.
#   Para apagar API+Web usar stop.bat.
#
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-remote.ps1 "<raiz>\"

param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'
$Root = $Root.TrimEnd('\')
$logs = Join-Path $Root 'logs'
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }

# Verifica cloudflared
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  $fallback = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
  if (Test-Path $fallback) {
    $cfPath = $fallback
  } else {
    Write-Host 'ERROR: cloudflared no esta instalado.' -ForegroundColor Red
    Write-Host 'Instalalo con:  winget install --id Cloudflare.cloudflared' -ForegroundColor Yellow
    exit 1
  }
} else {
  $cfPath = $cf.Source
}

function Test-Port {
  param([int]$Port)
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $Port)
    $c.Close()
    return $true
  } catch { return $false }
}

# Backend (si no esta ya en el 4001)
if (-not (Test-Port 4001)) {
  Write-Host 'Levantando backend (API :4001)...' -ForegroundColor Cyan
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c npm run start:dev > `"$logs\backend.log`" 2>&1" `
    -WorkingDirectory (Join-Path $Root 'src\backend') `
    -WindowStyle Hidden
} else {
  Write-Host 'API :4001 ya estaba en ejecucion.' -ForegroundColor DarkGray
}

# Frontend con API same-origin (si no esta ya en el 5173)
if (-not (Test-Port 5173)) {
  Write-Host 'Levantando frontend (Web :5173, API same-origin)...' -ForegroundColor Cyan
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c set VITE_API_URL=/api/v1 && npm run dev > `"$logs\frontend.log`" 2>&1" `
    -WorkingDirectory (Join-Path $Root 'src\frontend') `
    -WindowStyle Hidden
} else {
  Write-Host 'Web :5173 ya estaba en ejecucion.' -ForegroundColor DarkGray
}

# Espera a que el frontend responda (hasta ~40s)
Write-Host 'Esperando a que el frontend este listo...' -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  if (Test-Port 5173) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) {
  Write-Host 'El frontend no respondio en el puerto 5173. Revisa logs\frontend.log' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host ' Creando tunel de Cloudflare. La URL publica aparecera' -ForegroundColor Green
Write-Host ' abajo (https://XXXX.trycloudflare.com). Compartila para' -ForegroundColor Green
Write-Host ' acceder de forma remota. Ctrl+C baja SOLO el tunel.' -ForegroundColor Green
Write-Host '========================================================' -ForegroundColor Green
Write-Host ''

# cloudflared en primer plano: imprime la URL y mantiene el tunel abierto.
& $cfPath tunnel --url http://localhost:5173
