param([string]$OutputDirectory = 'build\v0.15.8')
$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$out = Join-Path $PSScriptRoot $OutputDirectory
$arguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'HtmlReaderSmoke.exe')))
foreach ($reference in @('System.dll','System.Core.dll','System.Xaml.dll','WPF\PresentationFramework.dll','WPF\PresentationCore.dll','WPF\WindowsBase.dll')) { $arguments += '/reference:' + (Join-Path $framework $reference) }
foreach ($reference in @('TMA-Mail.exe','Microsoft.Web.WebView2.Wpf.dll','Microsoft.Web.WebView2.Core.dll')) { $arguments += '/reference:' + (Join-Path $out $reference) }
$arguments += Join-Path $PSScriptRoot 'tests\HtmlReaderSmoke.cs'
& (Join-Path $framework 'csc.exe') @arguments
if ($LASTEXITCODE -ne 0) { throw 'Reader test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'HtmlReaderSmoke.exe.config') -Force
& (Join-Path $out 'HtmlReaderSmoke.exe') (Join-Path $out ('test-data\reader-' + [guid]::NewGuid().ToString())) (Join-Path $PSScriptRoot 'assets\TMA-Mail.png')
if ($LASTEXITCODE -ne 0) { throw 'HTML reader check failed.' }
