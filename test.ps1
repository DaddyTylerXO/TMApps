$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\build.ps1"
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$wpf = Join-Path $framework 'WPF'
$refs = @('System.dll','System.Core.dll','System.Security.dll','System.Net.Http.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','System.Xaml.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
$refs += @('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll') | ForEach-Object { '/reference:' + (Join-Path $wpf $_) }
& "$framework\csc.exe" /nologo /target:exe /platform:x64 "/out:$PSScriptRoot\build\Launcher.Tests.exe" @refs "$PSScriptRoot\src\Core.cs" "$PSScriptRoot\src\App.cs" "$PSScriptRoot\tests\Tests.cs" /main:TMApps.Tests
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
& "$PSScriptRoot\build\Launcher.Tests.exe" $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw 'Launcher tests failed' }
