$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
Start-Process -FilePath (Join-Path $PSScriptRoot 'build\v0.9.1-release\TMA-Mail.exe')
