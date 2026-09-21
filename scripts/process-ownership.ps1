# Ownership requires a repository path in the command line or verified ancestry.
function Test-ProjectProcess {
    param([object]$Process, [string]$ProjectRoot, [scriptblock]$Lookup)
    if (-not $Process) { return $false }
    if (-not $Lookup) {
        $Lookup = { param($ProcessId) Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue }
    }
    $normalizedRoot = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\','/').Replace('/','\')
    $pattern = '(?i)(?<![a-z0-9_])' + [regex]::Escape($normalizedRoot) + '(?=[\\/""''\s]|$)'
    $seen = @{}
    $current = $Process
    for ($depth = 0; $depth -lt 12 -and $current; $depth++) {
        if ($seen.ContainsKey([string]$current.ProcessId)) { break }
        $seen[[string]$current.ProcessId] = $true
        if ($current.CommandLine -and $current.CommandLine.Replace('/','\') -match $pattern) { return $true }
        if (-not $current.ParentProcessId) { break }
        $parent = & $Lookup $current.ParentProcessId
        if ($parent -and $parent.CreationDate -and $current.CreationDate -and $parent.CreationDate -gt $current.CreationDate) { break }
        $current = $parent
    }
    return $false
}
function Assert-ProjectPorts {
    param([int[]]$Ports, [string]$ProjectRoot)
    foreach ($port in $Ports) {
        foreach ($connection in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
            $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
            if (-not (Test-ProjectProcess $candidate $ProjectRoot)) {
                throw "Puerto $port ocupado por PID $($connection.OwningProcess), propiedad no comprobada. No se detuvo ningun proceso."
            }
        }
    }
}
function Stop-VerifiedProjectProcess {
    param([object]$Process, [string]$ProjectRoot)
    if (-not $Process -or $Process.ProcessId -eq $PID) { return }
    if (-not (Test-ProjectProcess $Process $ProjectRoot)) { return }
    $fresh = Get-CimInstance Win32_Process -Filter "ProcessId=$($Process.ProcessId)" -ErrorAction SilentlyContinue
    if (-not $fresh -or $fresh.CreationDate -ne $Process.CreationDate) { return }
    if (-not (Test-ProjectProcess $fresh $ProjectRoot)) { return }
    Stop-Process -Id $fresh.ProcessId -Force -ErrorAction Stop
    Write-Host "Detenido proceso propio PID $($fresh.ProcessId)."
}
function Stop-ProjectPorts {
    param([int[]]$Ports, [string]$ProjectRoot)
    $processed = @{}
    foreach ($port in $Ports) {
        foreach ($connection in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
            $processIdValue = $connection.OwningProcess
            if ($processed.ContainsKey([string]$processIdValue)) { continue }
            $processed[[string]$processIdValue] = $true
            $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$processIdValue" -ErrorAction SilentlyContinue
            if (Test-ProjectProcess $candidate $ProjectRoot) {
                Stop-VerifiedProjectProcess $candidate $ProjectRoot
            } else {
                Write-Warning "Se conserva PID $processIdValue en puerto $($port): propiedad no comprobada."
            }
        }
    }
}

# ---------------------------------------------------------------------------------------------
# Pila LeagueCore (API + Web + tunel de Cloudflare): deteccion y parada de procesos PROPIOS.
# Regla del repo: detener solo procesos identificados como propios. Un proceso es propio si su
# linea de comandos contiene la ruta de este repo (o, para cloudflared, el destino del tunel).
# ---------------------------------------------------------------------------------------------

function Test-CommandLineHasRoot {
    param([string]$CommandLine, [string]$ProjectRoot)
    if (-not $CommandLine) { return $false }
    $normalizedRoot = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\','/').Replace('/','\')
    $pattern = '(?i)(?<![a-z0-9_])' + [regex]::Escape($normalizedRoot) + '(?=[\\/""''\s]|$)'
    return ($CommandLine.Replace('/','\') -match $pattern)
}

# Watcher/servidor de Nest, Vite, envoltorios "npm run ..." y el cloudflared que apunta a la Web.
# Nunca devuelve procesos de otros proyectos (p. ej. otro nest start --watch en otra carpeta).
function Get-ProjectStackProcesses {
    param([string]$ProjectRoot, [int]$WebPort = 5173)
    $tunnelTarget = [regex]::Escape("http://localhost:$WebPort")
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $cl = $_.CommandLine
        if (-not $cl) { return $false }
        if ($_.Name -ieq 'cloudflared.exe') { return ($cl -match $tunnelTarget) }
        if ($_.Name -notmatch '^(node|cmd)\.exe$') { return $false }
        if (-not (Test-CommandLineHasRoot $cl $ProjectRoot)) { return $false }
        return ($cl -match '(?i)nest\.js|[\\/]dist[\\/]main|vite[\\/]bin[\\/]vite\.js|npm run (start:dev|dev)|logs[\\/](backend|frontend)\.log')
    }
}

function Stop-ProcessTree {
    param([int]$ProcessId, [string]$Reason)
    # Un PID puede haber muerto ya como hijo de otro arbol detenido antes: no es un error.
    if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { return }
    # taskkill escribe en stderr si falla; con $ErrorActionPreference='Stop' eso abortaria el script.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-Null } finally { $ErrorActionPreference = $previous }
    Write-Host "Detenido PID $ProcessId y sus procesos hijos ($Reason)."
}

# Detiene la pila completa: PIDs registrados por el lanzador, barrido de procesos propios y
# duenos verificados de los puertos. Mata el ARBOL de cada proceso para no dejar huerfanos.
function Stop-ProjectStack {
    param([string]$ProjectRoot, [int[]]$Ports = @(4001, 5173))
    $stopped = @{}
    $count = 0

    # 1) PIDs que registro el lanzador (se valida la fecha de creacion: el PID puede haberse reutilizado)
    $stackFile = Join-Path $ProjectRoot 'logs\stack.json'
    if (Test-Path $stackFile) {
        try {
            $saved = Get-Content $stackFile -Raw | ConvertFrom-Json
            foreach ($name in $saved.PSObject.Properties.Name) {
                $entry = $saved.$name
                $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)" -ErrorAction SilentlyContinue
                if ($p -and $p.CreationDate -and $p.CreationDate.ToUniversalTime().ToString('o') -eq $entry.created) {
                    Stop-ProcessTree -ProcessId $p.ProcessId -Reason $name
                    $stopped[[string]$p.ProcessId] = $true; $count++
                }
            }
        } catch { Write-Warning "No se pudo leer logs\stack.json: $($_.Exception.Message)" }
    }

    # 2) Barrido de procesos propios (cubre lo lanzado a mano o por versiones anteriores del arranque)
    foreach ($p in @(Get-ProjectStackProcesses -ProjectRoot $ProjectRoot -WebPort ($Ports | Select-Object -Last 1))) {
        if ($stopped.ContainsKey([string]$p.ProcessId)) { continue }
        Stop-ProcessTree -ProcessId $p.ProcessId -Reason $p.Name
        $stopped[[string]$p.ProcessId] = $true; $count++
    }

    # 3) Duenos de los puertos: solo si se comprueba que son propios. Los ajenos se informan y se respetan.
    foreach ($port in $Ports) {
        foreach ($connection in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
            $owner = $connection.OwningProcess
            if ($stopped.ContainsKey([string]$owner)) { continue }
            $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$owner" -ErrorAction SilentlyContinue
            if (Test-ProjectProcess $candidate $ProjectRoot) {
                Stop-ProcessTree -ProcessId $owner -Reason "puerto $port"
                $stopped[[string]$owner] = $true; $count++
            } else {
                Write-Warning "Se conserva PID $owner en el puerto ${port}: no es de LeagueCore (propiedad no comprobada)."
            }
        }
    }

    Remove-Item -Path $stackFile -ErrorAction SilentlyContinue
    return $count
}
