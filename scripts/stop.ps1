$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'process-ownership.ps1')
$projectRoot = Split-Path -Parent $PSScriptRoot
Stop-ProjectPorts -Ports @(4001, 5173) -ProjectRoot $projectRoot
