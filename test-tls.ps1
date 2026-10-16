param([string]$OutputDirectory = 'build\v0.9.2')
$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$out = Join-Path $PSScriptRoot $OutputDirectory
$arguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'TlsSmoke.exe')))
foreach ($reference in @('System.dll','System.Core.dll','System.Xaml.dll','WPF\PresentationCore.dll','WPF\PresentationFramework.dll','WPF\WindowsBase.dll')) { $arguments += '/reference:' + (Join-Path $framework $reference) }
foreach ($reference in @('TMA-Mail.exe','MailKit.dll','MimeKit.dll')) { $arguments += '/reference:' + (Join-Path $out $reference) }
$arguments += Join-Path $PSScriptRoot 'tests\TlsSmoke.cs'
& (Join-Path $framework 'csc.exe') @arguments
if ($LASTEXITCODE -ne 0) { throw 'TLS smoke test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'TlsSmoke.exe.config') -Force
& (Join-Path $out 'TlsSmoke.exe')
if ($LASTEXITCODE -ne 0) { throw 'Apple TLS smoke test failed.' }
