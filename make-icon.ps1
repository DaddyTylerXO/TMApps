$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$assets = Join-Path $PSScriptRoot 'assets'
New-Item -ItemType Directory -Force $assets | Out-Null
$drawing = @'
<Viewbox xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
 <Border Width="64" Height="64" CornerRadius="14" Background="#CC5500">
  <Canvas Width="64" Height="64">
   <Canvas.RenderTransform><RotateTransform Angle="35" CenterX="32" CenterY="32"/></Canvas.RenderTransform>
   <Path Data="M24,28 L15,39 L15,47 L27,40 Z M40,28 L49,39 L49,47 L37,40 Z" Fill="#FFF1E5"/>
   <Path Data="M32,8 C23,17 21,28 24,41 L40,41 C43,28 41,17 32,8 Z" Fill="White"/>
   <Ellipse Width="10" Height="10" Canvas.Left="27" Canvas.Top="21" Fill="#CC5500"/>
   <Path Data="M28,45 Q32,58 36,45 Q32,48 28,45 Z" Fill="White"/>
  </Canvas>
 </Border>
</Viewbox>
'@
$frames = @()
foreach ($size in @(16,24,32,48,64,128,256)) {
    $visual = [Windows.Markup.XamlReader]::Parse($drawing)
    $visual.Measure([Windows.Size]::new($size,$size))
    $visual.Arrange([Windows.Rect]::new(0,0,$size,$size))
    $visual.UpdateLayout()
    $bitmap = [Windows.Media.Imaging.RenderTargetBitmap]::new($size,$size,96,96,[Windows.Media.PixelFormats]::Pbgra32)
    $bitmap.Render($visual)
    $encoder = [Windows.Media.Imaging.PngBitmapEncoder]::new()
    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $memory = [IO.MemoryStream]::new()
    $encoder.Save($memory)
    $frames += @{ Size=$size; Bytes=$memory.ToArray() }
    $memory.Dispose()
}
$stream = [IO.File]::Create((Join-Path $assets 'TMApps-Launcher.ico'))
$writer = [IO.BinaryWriter]::new($stream)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
    $offset = 6 + 16 * $frames.Count
    foreach ($frame in $frames) {
        $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
        $offset += $frame.Bytes.Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
} finally { $writer.Dispose(); $stream.Dispose() }
[IO.File]::WriteAllBytes((Join-Path $assets 'TMApps-Launcher.png'), $frames[-1].Bytes)
Write-Host 'Generated multi-resolution orange rocket icon (16–256 px).'
