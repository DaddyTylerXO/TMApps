param([string]$OutputDirectory = 'build')
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot $OutputDirectory
New-Item -ItemType Directory -Force $out | Out-Null
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$wpf = Join-Path $framework 'WPF'
$refs = @('System.dll','System.Core.dll','System.Security.dll','System.Net.Http.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','System.Xaml.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
$refs += @('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll') | ForEach-Object { '/reference:' + (Join-Path $wpf $_) }
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ "/out:$out\TMApps-Launcher.exe" @refs "/resource:$PSScriptRoot\src\MainWindow.xaml,TMApps.MainWindow.xaml" "/resource:$PSScriptRoot\catalog.json,TMApps.catalog.json" "$PSScriptRoot\src\Core.cs" "$PSScriptRoot\src\App.cs"
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Write-Host "Built standalone $out\TMApps-Launcher.exe"
