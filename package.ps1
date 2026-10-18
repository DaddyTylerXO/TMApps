param([string]$OutputDirectory = 'build\v0.16.0')
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot $OutputDirectory
$stage = Join-Path $PSScriptRoot ('build\package-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($file in @('TMA-Mail.exe','TMA-Mail.exe.config','MainWindow.xaml')) { Copy-Item -LiteralPath (Join-Path $out $file) -Destination $stage }
$publicProviderPath = Join-Path $PSScriptRoot 'provider-settings.public.json'
$publicProvider = Get-Content -LiteralPath $publicProviderPath -Raw | ConvertFrom-Json
if (![string]::IsNullOrWhiteSpace($publicProvider.GmailDesktopClientSecret)) { throw 'Public packages must not contain a Google OAuth client secret. Keep it in the ignored local provider-settings.json only.' }
Copy-Item -LiteralPath $publicProviderPath -Destination (Join-Path $stage 'provider-settings.json')
Get-ChildItem -LiteralPath $out -Filter *.dll | Copy-Item -Destination $stage
foreach ($file in @('README.md','SETUP.md','CHANGELOG.md','THIRD_PARTY.md','SECURITY.md')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $stage }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'licenses') -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $out 'Sounds') -Destination $stage -Recurse
foreach ($file in @('PLUGINS.md','PORTABILITY.md','example.tmaplugin.json','update.json')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $stage }
$archive = Join-Path $out 'TMA-Mail-0.16.0-beta-windows.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -Force
try { & (Join-Path $PSScriptRoot 'check-secrets.ps1') -Paths @($archive) }
catch { Remove-Item -LiteralPath $archive -Force; if (Test-Path -LiteralPath ($archive + '.sha256')) { Remove-Item -LiteralPath ($archive + '.sha256') -Force }; throw }
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($archive + '.sha256') -Value ($hash + '  ' + [IO.Path]::GetFileName($archive)) -Encoding ascii
Write-Host "Packaged $archive"
