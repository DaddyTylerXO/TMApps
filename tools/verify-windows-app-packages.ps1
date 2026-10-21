param([Parameter(Mandatory=$true)][string]$CatalogPath,[Parameter(Mandatory=$true)][string]$PackageDirectory,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$framework=Split-Path $compiler
$verifier=Join-Path $root 'build/VerifyAppPackages.exe'
$CatalogPath=(Resolve-Path -LiteralPath $CatalogPath).Path
$PackageDirectory=(Resolve-Path -LiteralPath $PackageDirectory).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory=(Resolve-Path -LiteralPath $OutputDirectory).Path
& $compiler /nologo /target:exe /platform:x64 "/out:$verifier" "/reference:$root/build/TMApps-Launcher.exe" "/reference:$framework/System.dll" "/reference:$framework/System.Core.dll" "/reference:$framework/System.Net.Http.dll" (Join-Path $PSScriptRoot 'VerifyAppPackages.cs')
if($LASTEXITCODE -ne 0){throw 'Package lifecycle verifier compilation failed'}
& $verifier $CatalogPath $PackageDirectory $OutputDirectory install
if($LASTEXITCODE -ne 0){throw 'Real app installation verification failed'}
$librariesExe=Get-Content (Join-Path $OutputDirectory 'tma-libraries-executable.txt') -Raw
$libraries=Start-Process -FilePath $librariesExe -ArgumentList '--smoke' -WindowStyle Hidden -PassThru
if(-not $libraries.WaitForExit(30000)){Stop-Process -Id $libraries.Id -Force;throw 'Installed Libraries smoke check timed out'}
if($libraries.ExitCode -ne 0){throw 'Installed Libraries smoke check failed'}
& (Join-Path $PSScriptRoot 'verify-finance-package.ps1') -Executable (Get-Content (Join-Path $OutputDirectory 'tma-finance-executable.txt') -Raw) -OutputDirectory (Join-Path $OutputDirectory 'finance-verification')
& $verifier $CatalogPath $PackageDirectory $OutputDirectory uninstall
if($LASTEXITCODE -ne 0){throw 'Real app uninstallation verification failed'}
Write-Output 'Real package installation, app launch and uninstallation verified using isolated folders; personal data was untouched.'
