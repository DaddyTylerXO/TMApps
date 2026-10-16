param([string]$OutputDirectory = 'build')
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot $OutputDirectory
New-Item -ItemType Directory -Force $out | Out-Null
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$wpf = Join-Path $framework 'WPF'
$refs = @('System.dll','System.Core.dll','System.Net.Http.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','System.Xaml.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
$refs += @('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll') | ForEach-Object { '/reference:' + (Join-Path $wpf $_) }
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ "/out:$out\TMApps Launcher.exe" @refs "$PSScriptRoot\src\Core.cs" "$PSScriptRoot\src\App.cs"
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Copy-Item "$PSScriptRoot\src\MainWindow.xaml" $out
Copy-Item "$PSScriptRoot\catalog.json" $out
Copy-Item "$PSScriptRoot\src\TMApps Launcher.exe.config" $out
Write-Host "Built $out\TMApps Launcher.exe"
