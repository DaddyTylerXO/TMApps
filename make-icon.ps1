$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = Join-Path $PSScriptRoot 'assets'
New-Item -ItemType Directory -Force $assetDir | Out-Null
$images = @()
foreach ($size in @(16,24,32,48,64,128,256)) {
    $bitmap = New-Object System.Drawing.Bitmap($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.ScaleTransform(($size/64.0),($size/64.0))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(2,2,22,22,180,90); $path.AddArc(40,2,22,22,270,90); $path.AddArc(40,40,22,22,0,90); $path.AddArc(2,40,22,22,90,90); $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#3A8C5E'))
    $graphics.FillPath($brush,$path)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White,3.6)
    $pen.LineJoin = 'Round'; $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
    $graphics.DrawRectangle($pen,12,19,40,29)
    $graphics.DrawLines($pen,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(13,21),[System.Drawing.PointF]::new(32,34),[System.Drawing.PointF]::new(51,21)))
    $graphics.DrawLine($pen,13,46,25,35); $graphics.DrawLine($pen,51,46,39,35)
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
    $images += ,@($size,$stream.ToArray())
    if ($size -eq 256) { $bitmap.Save((Join-Path $assetDir 'TMA-Mail.png'),[System.Drawing.Imaging.ImageFormat]::Png) }
    $stream.Dispose(); $pen.Dispose(); $brush.Dispose(); $path.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$file = [System.IO.File]::Create((Join-Path $assetDir 'TMA-Mail.ico'))
$writer = New-Object System.IO.BinaryWriter($file)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$images.Count)
$offset = 6 + 16 * $images.Count
foreach ($entry in $images) { $dimension=if ($entry[0] -eq 256) {0} else {$entry[0]}; $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$entry[1].Length); $writer.Write([uint32]$offset); $offset += $entry[1].Length }
foreach ($entry in $images) { $writer.Write([byte[]]$entry[1]) }; $writer.Dispose()
