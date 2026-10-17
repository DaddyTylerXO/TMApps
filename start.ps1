$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
Start-Process -FilePath (Join-Path $PSScriptRoot 'build\v0.15.1\TMA-Mail.exe')
