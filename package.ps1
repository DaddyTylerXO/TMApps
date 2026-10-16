param([string]$OutputDirectory = 'dist')
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\build.ps1"
$out = Join-Path $PSScriptRoot $OutputDirectory
New-Item -ItemType Directory -Force $out | Out-Null
$zip = Join-Path $out 'TMApps-Launcher-1.0.0-windows-x64.zip'
Compress-Archive -Path "$PSScriptRoot\build\TMApps Launcher.exe", "$PSScriptRoot\build\TMApps Launcher.exe.config", "$PSScriptRoot\build\MainWindow.xaml", "$PSScriptRoot\build\catalog.json", "$PSScriptRoot\README.md" -DestinationPath $zip -Force
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$zip.sha256" -Value "$hash  $([IO.Path]::GetFileName($zip))" -Encoding ascii
Write-Host "Packaged $zip"
