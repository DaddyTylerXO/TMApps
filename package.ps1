param([string]$OutputDirectory = 'dist')
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\build.ps1"
$out = Join-Path $PSScriptRoot $OutputDirectory
New-Item -ItemType Directory -Force $out | Out-Null
$exe = Join-Path $out 'TMApps-Launcher-Setup.exe'
Copy-Item -LiteralPath "$PSScriptRoot\build\TMApps-Launcher-Setup.exe" -Destination $exe -Force
$hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$exe.sha256" -Value "$hash  TMApps-Launcher-Setup.exe" -Encoding ascii
Write-Host "Packaged launcher installer $exe"
