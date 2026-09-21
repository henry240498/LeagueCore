# Levanta LeagueCore completo: API (backend) + Web (frontend) + tunel de Cloudflare. Todo oculto.
#
#  - Funciona en cualquier equipo y desde cualquier carpeta: todo se resuelve desde la ubicacion
#    del repo (-Root). No hay rutas fijas.
#  - Es idempotente: si la API, la Web o el tunel ya estan corriendo (y son de LeagueCore) se
#    reutilizan; nunca lanza duplicados. Si un puerto lo ocupa OTRO programa, informa y no lo toca.
#  - La Web siempre se levanta con VITE_API_URL=/api/v1 (mismo origen): el proxy de Vite reenvia
#    /api y /uploads al backend local. Asi la misma Web sirve por localhost y por el tunel.
#  - Si cloudflared no esta o el tunel falla, la app sigue funcionando en local.
#  - Primera vez en un equipo: instala dependencias (npm install) y crea src\backend\.env desde
#    .env.example si falta (hay que completarlo con los datos de SQL Server).
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File scripts\start-all.ps1 -Root "<raiz>" [-NoTunnel] [-Quiet]
#     -NoTunnel  no abre el tunel de Cloudflare (solo uso local)
#     -Quiet     no muestra ventanas emergentes ni abre el navegador (pruebas/automatizacion)
#
# Logs: logs\launcher.log, backend.log, frontend.log, tunnel.log. URL remota: logs\tunnel-url.txt
# Para apagar todo: stop.bat

param(
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [switch]$NoTunnel,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
. (Join-Path $PSScriptRoot 'process-ownership.ps1')

$ApiPort = 4001
$WebPort = 5173
$logs = Join-Path $Root 'logs'
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$launcherLog = Join-Path $logs 'launcher.log'
$stackFile = Join-Path $logs 'stack.json'
$urlFile = Join-Path $logs 'tunnel-url.txt'

function Write-Log {
  param([string]$Message)
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $launcherLog -Value $line -Encoding ASCII
}

# Ventana emergente no bloqueante para siempre (se cierra sola). Icono: 64 info, 48 aviso, 16 error.
function Show-Info {
  param([string]$Text, [int]$Seconds = 15, [int]$Icon = 64)
  Write-Log ($Text -replace "`r?`n", ' | ')
  if ($Quiet) { return }
  try { (New-Object -ComObject WScript.Shell).Popup($Text, $Seconds, 'LeagueCore', $Icon) | Out-Null } catch { }
}

function Get-PortOwner {
  param([int]$Port)
  $c = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue }
  return $null
}

function Wait-Port {
  param([int]$Port, [int]$TimeoutSec)
  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

# Registra el PID (y su fecha de creacion) para que stop.bat pueda detener el arbol completo.
function Save-Pid {
  param([string]$Name, $Process)
  $created = ''
  try {
    $created = (Get-CimInstance Win32_Process -Filter "ProcessId=$($Process.Id)").CreationDate.ToUniversalTime().ToString('o')
  } catch { }
  $data = @{}
  if (Test-Path $stackFile) {
    try {
      $old = Get-Content $stackFile -Raw | ConvertFrom-Json
      foreach ($n in $old.PSObject.Properties.Name) { $data[$n] = $old.$n }
    } catch { }
  }
  $data[$Name] = @{ pid = $Process.Id; created = $created }
  ($data | ConvertTo-Json -Depth 4) | Set-Content -Path $stackFile -Encoding ASCII
}

function Start-NpmScript {
  param([string]$Name, [string]$Dir, [string]$Script, [string]$LogFile)
  $cmdArgs = '/c npm run {0} > "{1}" 2>&1' -f $Script, $LogFile
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdArgs -WorkingDirectory $Dir -WindowStyle Hidden -PassThru
  Save-Pid $Name $p
}

# Devuelve $true si el servicio quedo escuchando (ya estaba o se levanto), $false si hay que abortar.
function Ensure-Service {
  param([string]$Name, [int]$Port, [string]$Dir, [string]$Script, [string]$LogFile, [int]$WaitSec)
  $owner = Get-PortOwner $Port
  if ($owner) {
    if (Test-ProjectProcess $owner $Root) {
      Write-Log "$Name ya estaba en marcha (puerto $Port, PID $($owner.ProcessId)); se reutiliza."
      return $true
    }
    Show-Info "El puerto $Port esta ocupado por otro programa (PID $($owner.ProcessId), $($owner.Name)) que NO es de LeagueCore.`nNo se lo detiene. Libera ese puerto y vuelve a abrir LeagueCore." 30 48
    return $false
  }
  Write-Log "Levantando $Name ($Script)..."
  Start-NpmScript $Name $Dir $Script $LogFile
  if (-not (Wait-Port $Port $WaitSec)) {
    Show-Info "$Name no respondio en el puerto $Port tras $WaitSec s.`nRevisa el log: $LogFile" 30 16
    return $false
  }
  Write-Log "$Name listo en el puerto $Port."
  return $true
}

# La Web debe usar la API por ruta relativa (/api/v1) o el tunel no funcionaria. Si una Web vieja,
# levantada con otra configuracion, sigue corriendo, se detecta y se reinicia (solo si es propia).
function Test-WebSameOrigin {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$WebPort/src/services/api.ts" -UseBasicParsing -TimeoutSec 15
    return ($r.Content -match '"VITE_API_URL"\s*:\s*"/api/v1"')
  } catch { return $true }
}

function Find-Cloudflared {
  $c = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $candidates = @(
    'C:\Program Files (x86)\cloudflared\cloudflared.exe',
    'C:\Program Files\cloudflared\cloudflared.exe',
    (Join-Path $Root 'tools\cloudflared.exe')
  )
  foreach ($x in $candidates) { if (Test-Path $x) { return $x } }
  if ($env:LOCALAPPDATA) {
    $wg = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wg) {
      $f = Get-ChildItem -Path $wg -Filter cloudflared.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($f) { return $f.FullName }
    }
  }
  return $null
}

function Read-TunnelUrl {
  param([string[]]$Files)
  foreach ($f in $Files) {
    if (-not (Test-Path $f)) { continue }
    # Se ignora api.trycloudflare.com (aparece en mensajes de error de cloudflared).
    $m = Select-String -Path $f -Pattern 'https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { return $m.Matches[0].Value }
  }
  return $null
}

# Devuelve la URL publica del tunel (o $null si no hay / fallo). Reutiliza un tunel propio vivo.
function Ensure-Tunnel {
  $tunnelProcs = @(Get-ProjectStackProcesses -ProjectRoot $Root -WebPort $WebPort | Where-Object { $_.Name -ieq 'cloudflared.exe' })
  if ($tunnelProcs.Count -gt 0 -and (Test-Path $urlFile)) {
    $existing = (Get-Content $urlFile -Raw).Trim()
    if ($existing) { Write-Log "Tunel ya activo, se reutiliza: $existing"; return $existing }
  }
  foreach ($p in $tunnelProcs) { Stop-ProcessTree -ProcessId $p.ProcessId -Reason 'tunel sin URL registrada' | Out-Null }
  Remove-Item -Path $urlFile -ErrorAction SilentlyContinue

  $cf = Find-Cloudflared
  if (-not $cf) {
    Show-Info "LeagueCore funciona en local, pero falta cloudflared para el acceso remoto.`nInstalalo con:  winget install --id Cloudflare.cloudflared`n(o ejecuta 'Instalar accesos directos.bat', que te lo ofrece)." 30 48
    return $null
  }
  $errLog = Join-Path $logs 'tunnel.log'
  $outLog = Join-Path $logs 'tunnel.out.log'
  Remove-Item -Path $errLog, $outLog -ErrorAction SilentlyContinue
  Write-Log "Abriendo tunel de Cloudflare ($cf)..."
  # --protocol http2: muchas redes (hogar, oficina) bloquean el UDP saliente que usa QUIC (puerto 7844)
  # y en modo 'auto' cloudflared se queda reintentando QUIC sin conectar. HTTP2 va por TCP y funciona en todas.
  $p = Start-Process -FilePath $cf -ArgumentList @('tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', "http://localhost:$WebPort") `
    -WindowStyle Hidden -RedirectStandardError $errLog -RedirectStandardOutput $outLog -PassThru
  Save-Pid 'tunnel' $p

  # 1) cloudflared imprime la URL publica al crear el tunel...
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    $url = Read-TunnelUrl @($errLog, $outLog)
    if (-not $url) {
      if ($p.HasExited) { break }
      Start-Sleep -Seconds 1
    }
  }
  # 2) ...pero solo funciona cuando el conector de esta PC se registra en Cloudflare.
  $connected = $false
  if ($url) {
    for ($i = 0; $i -lt 45; $i++) {
      if ((Select-String -Path $errLog, $outLog -Pattern 'Registered tunnel connection' -Quiet -ErrorAction SilentlyContinue)) { $connected = $true; break }
      if ($p.HasExited) { break }
      Start-Sleep -Seconds 1
    }
  }
  if ($url -and $connected) {
    Set-Content -Path $urlFile -Value $url -Encoding ASCII
    Write-Log "Tunel listo y conectado: $url"
    return $url
  }
  Stop-ProcessTree -ProcessId $p.Id -Reason 'tunel sin conexion' | Out-Null
  Show-Info "LeagueCore funciona en local, pero el tunel de Cloudflare no logro conectarse (revisa tu Internet o firewall).`nDetalle en: $errLog" 30 48
  return $null
}

# --------------------------------------------------------------------------------------------
$mutex = New-Object System.Threading.Mutex($false, 'Local\LeagueCoreLauncher')
if (-not $mutex.WaitOne(0)) {
  Show-Info 'LeagueCore ya se esta iniciando. Espera unos segundos.' 8
  exit 0
}

try {
  Write-Log "==== Inicio (Root=$Root, NoTunnel=$NoTunnel) ===="

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Show-Info 'No se encontro Node.js (npm). Instalalo desde https://nodejs.org (version LTS) y vuelve a abrir LeagueCore.' 30 16
    exit 1
  }

  # Configuracion del backend (SQL Server, JWT). Sin esto la API no puede arrancar.
  $beEnv = Join-Path $Root 'src\backend\.env'
  if (-not (Test-Path $beEnv)) {
    $example = Join-Path $Root 'src\backend\.env.example'
    if (Test-Path $example) { Copy-Item -Path $example -Destination $beEnv }
    Show-Info "Falta la configuracion del backend. Se creo src\backend\.env desde .env.example.`nEditalo con los datos de tu SQL Server (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) y un JWT_SECRET propio, y vuelve a abrir LeagueCore." 40 48
    exit 1
  }

  # Primera vez en este equipo: dependencias.
  foreach ($app in @('backend', 'frontend')) {
    $dir = Join-Path $Root "src\$app"
    if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
      Show-Info "Primera vez en este equipo: instalando dependencias de $app.`nPuede tardar varios minutos; se abrira LeagueCore al terminar." 10
      $npmLog = Join-Path $logs "npm-install-$app.log"
      $p = Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c npm install --no-audit --no-fund > "{0}" 2>&1' -f $npmLog) `
        -WorkingDirectory $dir -WindowStyle Hidden -Wait -PassThru
      if ($p.ExitCode -ne 0) {
        Show-Info "No se pudieron instalar las dependencias de $app.`nRevisa el log: $npmLog" 30 16
        exit 1
      }
    }
  }

  # API
  if (-not (Ensure-Service 'backend' $ApiPort (Join-Path $Root 'src\backend') 'start:dev' (Join-Path $logs 'backend.log') 120)) { exit 1 }

  # Web (con la API por ruta relativa; el proxy de Vite la reenvia al backend)
  $webOwnerBefore = Get-PortOwner $WebPort
  $env:VITE_API_URL = '/api/v1'
  try {
    if (-not (Ensure-Service 'frontend' $WebPort (Join-Path $Root 'src\frontend') 'dev' (Join-Path $logs 'frontend.log') 90)) { exit 1 }
    if ($webOwnerBefore -and -not (Test-WebSameOrigin)) {
      Write-Log 'La Web en ejecucion usa otra URL de API; se reinicia para que funcione por el tunel.'
      foreach ($p in @(Get-ProjectStackProcesses -ProjectRoot $Root -WebPort $WebPort | Where-Object { $_.CommandLine -match '(?i)vite|npm run dev|frontend\.log' })) {
        Stop-ProcessTree -ProcessId $p.ProcessId -Reason 'Web con configuracion vieja' | Out-Null
      }
      Start-Sleep -Seconds 2
      if (-not (Ensure-Service 'frontend' $WebPort (Join-Path $Root 'src\frontend') 'dev' (Join-Path $logs 'frontend.log') 90)) { exit 1 }
    }
  } finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
  }

  # Tunel
  $url = $null
  if (-not $NoTunnel) { $url = Ensure-Tunnel }

  # Aviso final y navegador
  $local = "http://localhost:$WebPort"
  if ($url) {
    try { Set-Clipboard -Value $url } catch { }
    Show-Info "LeagueCore esta en marcha.`n`nEn esta PC:  $local`nAcceso remoto:  $url`n(el enlace remoto quedo copiado al portapapeles)`n`nPara volver a verlo: acceso directo 'LeagueCore (enlace remoto)'." 20
  } else {
    Write-Log "LeagueCore en marcha (solo local): $local"
  }
  if (-not $Quiet) { Start-Process $local }
  Write-Log '==== Listo ===='
}
catch {
  Show-Info "Error al iniciar LeagueCore:`n$($_.Exception.Message)`nDetalle en logs\launcher.log" 30 16
  Write-Log ($_ | Out-String)
  exit 1
}
finally {
  $mutex.ReleaseMutex()
}
