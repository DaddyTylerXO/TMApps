param([string]$OutputDirectory = 'build\v0.7-release')
$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$out = Join-Path $PSScriptRoot $OutputDirectory
New-Item -ItemType Directory -Path $out -Force | Out-Null
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:' + (Join-Path $out 'MailStoreTests.exe')) ('/reference:' + (Join-Path $out 'TMA-Mail.exe')) (Join-Path $PSScriptRoot 'tests\MailStoreTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& (Join-Path $out 'MailStoreTests.exe') (Join-Path $out 'test-data')
if ($LASTEXITCODE -ne 0) { throw 'Mailbox checks failed.' }
$layoutArguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'LayoutTests.exe')))
foreach ($reference in @('System.dll', 'System.Core.dll', 'System.Xaml.dll', 'WPF\WindowsBase.dll', 'WPF\PresentationCore.dll', 'WPF\PresentationFramework.dll')) { $layoutArguments += '/reference:' + (Join-Path $framework $reference) }
$layoutArguments += Join-Path $PSScriptRoot 'tests\LayoutTests.cs'
& (Join-Path $framework 'csc.exe') @layoutArguments
if ($LASTEXITCODE -ne 0) { throw 'Layout test compilation failed.' }
& (Join-Path $out 'LayoutTests.exe') (Join-Path $PSScriptRoot 'src\MainWindow.xaml')
if ($LASTEXITCODE -ne 0) { throw 'Layout checks failed.' }
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:' + (Join-Path $out 'SettingsTests.exe')) ('/reference:' + (Join-Path $framework 'System.Web.Extensions.dll')) (Join-Path $PSScriptRoot 'src\Settings.cs') (Join-Path $PSScriptRoot 'tests\SettingsTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Settings test compilation failed.' }
& (Join-Path $out 'SettingsTests.exe') (Join-Path $out 'test-data')
if ($LASTEXITCODE -ne 0) { throw 'Settings checks failed.' }
$workspaceArguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'WorkspaceTests.exe')), ('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach ($reference in @('System.dll', 'System.Core.dll', 'System.Xaml.dll', 'WPF\WindowsBase.dll', 'WPF\PresentationCore.dll', 'WPF\PresentationFramework.dll')) { $workspaceArguments += '/reference:' + (Join-Path $framework $reference) }
$workspaceArguments += Join-Path $PSScriptRoot 'tests\WorkspaceTests.cs'
& (Join-Path $framework 'csc.exe') @workspaceArguments
if ($LASTEXITCODE -ne 0) { throw 'Workspace test compilation failed.' }
& (Join-Path $out 'WorkspaceTests.exe') --data-dir (Join-Path $out ('test-data\workspace-' + [guid]::NewGuid().ToString()))
if ($LASTEXITCODE -ne 0) { throw 'Workspace checks failed.' }
$connectionArguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'ConnectionTests.exe')), ('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach ($reference in @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Xaml.dll', 'WPF\WindowsBase.dll', 'WPF\PresentationCore.dll', 'WPF\PresentationFramework.dll')) { $connectionArguments += '/reference:' + (Join-Path $framework $reference) }
foreach ($reference in @('MailKit.dll','MimeKit.dll')) { $connectionArguments += '/reference:' + (Join-Path $out $reference) }
$connectionArguments += Join-Path $PSScriptRoot 'tests\ConnectionTests.cs'
& (Join-Path $framework 'csc.exe') @connectionArguments
if ($LASTEXITCODE -ne 0) { throw 'Connection test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'ConnectionTests.exe.config') -Force
& (Join-Path $out 'ConnectionTests.exe') (Join-Path $out 'test-data')
if ($LASTEXITCODE -ne 0) { throw 'Connection checks failed.' }
