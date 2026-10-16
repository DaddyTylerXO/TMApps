param([string]$OutputDirectory = 'build\v0.9.1-release')
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot $OutputDirectory
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe ('/out:' + (Join-Path $out 'MediaSmoke.exe')) ('/reference:' + (Join-Path $out 'TMA-Mail.exe')) (Join-Path $PSScriptRoot 'tests\MediaSmoke.cs')
if ($LASTEXITCODE -ne 0) { throw 'Media smoke check compilation failed.' }
& (Join-Path $out 'MediaSmoke.exe')
if ($LASTEXITCODE -ne 0) { throw 'Windows media discovery failed. Run this check from a normal interactive Windows session.' }
