param([string]$OutputDirectory = 'build\v0.15.6')
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot $OutputDirectory
$stage = Join-Path $PSScriptRoot ('build\package-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($file in @('TMA-Mail.exe','TMA-Mail.exe.config','MainWindow.xaml','provider-settings.json')) { Copy-Item -LiteralPath (Join-Path $out $file) -Destination $stage }
Get-ChildItem -LiteralPath $out -Filter *.dll | Copy-Item -Destination $stage
foreach ($file in @('README.md','SETUP.md','CHANGELOG.md','THIRD_PARTY.md')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $stage }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'licenses') -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $out 'Sounds') -Destination $stage -Recurse
foreach ($file in @('PLUGINS.md','PORTABILITY.md','example.tmaplugin.json','update.json')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $stage }
$archive = Join-Path $out 'TMA-Mail-0.15.6-beta-windows.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -Force
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($archive + '.sha256') -Value ($hash + '  ' + [IO.Path]::GetFileName($archive)) -Encoding ascii
Write-Host "Packaged $archive"
