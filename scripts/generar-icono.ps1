# Genera leaguecore.ico (icono multi-resolucion) a partir de docs/layer-soccer-ball.png.
# El .ico se usa para el acceso directo "LeagueCore" del Escritorio.
#
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generar-icono.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'docs\layer-soccer-ball.png'
$outIco = Join-Path $root 'leaguecore.ico'

if (-not (Test-Path $src)) { throw "No se encontro $src" }

$source = [System.Drawing.Image]::FromFile($src)
$sizes = @(16, 32, 48, 64, 128, 256)
$pngBlobs = @()

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  # Centrar preservando la relacion de aspecto
  $scale = [Math]::Min($s / $source.Width, $s / $source.Height)
  $w = [int]($source.Width * $scale)
  $h = [int]($source.Height * $scale)
  $x = [int](($s - $w) / 2)
  $y = [int](($s - $h) / 2)
  $g.DrawImage($source, $x, $y, $w, $h)
  $g.Dispose()

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBlobs += ,($ms.ToArray())
  $ms.Dispose()
  $bmp.Dispose()
}
$source.Dispose()

# Construir el archivo .ico (entradas PNG, validas desde Windows Vista)
$fs = New-Object System.IO.FileStream($outIco, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR
$bw.Write([UInt16]0)                 # reservado
$bw.Write([UInt16]1)                 # tipo = icono
$bw.Write([UInt16]$sizes.Count)      # cantidad de imagenes

$offset = 6 + (16 * $sizes.Count)    # datos luego del directorio
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $blob = $pngBlobs[$i]
  $dim = if ($s -ge 256) { 0 } else { $s }   # 0 significa 256
  $bw.Write([byte]$dim)              # ancho
  $bw.Write([byte]$dim)              # alto
  $bw.Write([byte]0)                 # colores en paleta
  $bw.Write([byte]0)                 # reservado
  $bw.Write([UInt16]1)               # planos
  $bw.Write([UInt16]32)              # bits por pixel
  $bw.Write([UInt32]$blob.Length)    # tamano de la imagen
  $bw.Write([UInt32]$offset)         # offset de la imagen
  $offset += $blob.Length
}
foreach ($blob in $pngBlobs) { $bw.Write($blob) }

$bw.Flush(); $bw.Close(); $fs.Close()
Write-Host "Icono generado: $outIco" -ForegroundColor Green
