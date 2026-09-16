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
