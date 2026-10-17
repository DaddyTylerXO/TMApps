$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
Start-Process -FilePath (Join-Path $PSScriptRoot 'build\v0.12.0\TMA-Mail.exe')
