param([string]$OutputDirectory = 'build\v0.15.8')
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'tests\SecretScanTests.ps1')
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
& (Join-Path $framework 'csc.exe') /nologo /target:exe ('/out:' + (Join-Path $out 'SettingsTests.exe')) ('/reference:' + (Join-Path $framework 'System.Web.Extensions.dll')) (Join-Path $PSScriptRoot 'src\Settings.cs') (Join-Path $PSScriptRoot 'src\Sounds.cs') (Join-Path $PSScriptRoot 'tests\SettingsTests.cs')
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
$providerArguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'ProviderSetupTests.exe')), ('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
$providerArguments += '/reference:' + (Join-Path $out 'MailKit.dll')
$providerArguments += '/reference:' + (Join-Path $out 'Microsoft.Identity.Client.dll')
foreach ($reference in @('System.dll', 'System.Core.dll', 'System.Xaml.dll', 'WPF\WindowsBase.dll', 'WPF\PresentationCore.dll', 'WPF\PresentationFramework.dll')) { $providerArguments += '/reference:' + (Join-Path $framework $reference) }
$providerArguments += Join-Path $PSScriptRoot 'tests\ProviderSetupTests.cs'
& (Join-Path $framework 'csc.exe') @providerArguments
if ($LASTEXITCODE -ne 0) { throw 'Provider setup test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'ProviderSetupTests.exe.config') -Force
& (Join-Path $out 'ProviderSetupTests.exe') (Join-Path $out 'test-data')
if ($LASTEXITCODE -ne 0) { throw 'Provider setup checks failed.' }
$msalJsonArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'MsalJsonTests.exe')),('/reference:' + (Join-Path $out 'Microsoft.Identity.Client.dll')),('/reference:' + (Join-Path $framework 'System.Core.dll')))
$msalJsonArguments += Join-Path $PSScriptRoot 'tests\MsalJsonTests.cs'
& (Join-Path $framework 'csc.exe') @msalJsonArguments
if ($LASTEXITCODE -ne 0) { throw 'MSAL JSON test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'MsalJsonTests.exe.config') -Force
& (Join-Path $out 'MsalJsonTests.exe')
if ($LASTEXITCODE -ne 0) { throw 'MSAL JSON dependency tests failed.' }
$liveArguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'LiveMailboxTests.exe')), ('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach ($reference in @('System.dll','System.Core.dll','System.Web.Extensions.dll','System.Xaml.dll','WPF\PresentationFramework.dll','WPF\PresentationCore.dll','WPF\WindowsBase.dll')) { $liveArguments += '/reference:' + (Join-Path $framework $reference) }
$liveArguments += Join-Path $PSScriptRoot 'tests\LiveMailboxTests.cs'
& (Join-Path $framework 'csc.exe') @liveArguments
if ($LASTEXITCODE -ne 0) { throw 'Live mailbox test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'LiveMailboxTests.exe.config') -Force
& (Join-Path $out 'LiveMailboxTests.exe') --data-dir (Join-Path $out ('test-data\live-' + [guid]::NewGuid().ToString()))
if ($LASTEXITCODE -ne 0) { throw 'Live mailbox workspace checks failed.' }

$responsivenessArguments = @('/nologo', '/target:exe', ('/out:' + (Join-Path $out 'ResponsivenessTests.exe')), ('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach ($reference in @('System.dll','System.Core.dll','System.Xaml.dll','WPF\PresentationFramework.dll','WPF\PresentationCore.dll','WPF\WindowsBase.dll')) { $responsivenessArguments += '/reference:' + (Join-Path $framework $reference) }
$responsivenessArguments += Join-Path $PSScriptRoot 'tests\ResponsivenessTests.cs'
& (Join-Path $framework 'csc.exe') @responsivenessArguments
if ($LASTEXITCODE -ne 0) { throw 'Responsiveness test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'ResponsivenessTests.exe.config') -Force
& (Join-Path $out 'ResponsivenessTests.exe') --data-dir (Join-Path $out ('test-data\responsive-' + [guid]::NewGuid().ToString()))
if ($LASTEXITCODE -ne 0) { throw 'Responsiveness checks failed.' }

$suiteArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'SuiteFeaturesTests.exe')),('/reference:' + (Join-Path $out 'TMA-Mail.exe')),('/reference:' + (Join-Path $out 'MimeKit.dll')))
foreach($reference in @('System.dll','System.Core.dll','System.Net.Http.dll','System.Xaml.dll','WPF\WindowsBase.dll','WPF\PresentationCore.dll','WPF\PresentationFramework.dll')) { $suiteArguments += '/reference:' + (Join-Path $framework $reference) }
$suiteArguments += Join-Path $PSScriptRoot 'tests\SuiteFeaturesTests.cs'
& (Join-Path $framework 'csc.exe') @suiteArguments
if($LASTEXITCODE -ne 0) { throw 'Suite test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'SuiteFeaturesTests.exe.config') -Force
& (Join-Path $out 'SuiteFeaturesTests.exe') --data-dir (Join-Path $out ('test-data\suite-' + [guid]::NewGuid().ToString())) --offline-preview
if($LASTEXITCODE -ne 0) { throw 'Workspace-suite tests failed.' }

$calendarArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'CalendarProviderTests.exe')),('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach($reference in @('System.dll','System.Core.dll','System.Net.Http.dll')) { $calendarArguments += '/reference:' + (Join-Path $framework $reference) }
$calendarArguments += Join-Path $PSScriptRoot 'tests\CalendarProviderTests.cs'
& (Join-Path $framework 'csc.exe') @calendarArguments
if($LASTEXITCODE -ne 0) { throw 'Calendar provider test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'CalendarProviderTests.exe.config') -Force
& (Join-Path $out 'CalendarProviderTests.exe')
if($LASTEXITCODE -ne 0) { throw 'Calendar provider tests failed.' }

$calendarUiArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'CalendarUiTests.exe')),('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach($reference in @('System.dll','System.Core.dll','System.Xaml.dll','WPF\WindowsBase.dll','WPF\PresentationCore.dll','WPF\PresentationFramework.dll')) { $calendarUiArguments += '/reference:' + (Join-Path $framework $reference) }
$calendarUiArguments += '/reference:' + (Join-Path $framework 'System.Net.Http.dll')
$calendarUiArguments += Join-Path $PSScriptRoot 'tests\CalendarUiTests.cs'
& (Join-Path $framework 'csc.exe') @calendarUiArguments
if($LASTEXITCODE -ne 0) { throw 'Calendar UI test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'CalendarUiTests.exe.config') -Force
& (Join-Path $out 'CalendarUiTests.exe') --data-dir (Join-Path $out ('test-data\calendar-ui-' + [guid]::NewGuid().ToString())) --offline-preview
if($LASTEXITCODE -ne 0) { throw 'Calendar UI tests failed.' }

$mailToolsArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'MailToolsTests.exe')),('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach($reference in @('System.dll','System.Core.dll','System.Xaml.dll','WPF\WindowsBase.dll','WPF\PresentationCore.dll','WPF\PresentationFramework.dll')) { $mailToolsArguments += '/reference:' + (Join-Path $framework $reference) }
$mailToolsArguments += Join-Path $PSScriptRoot 'tests\MailToolsTests.cs'
& (Join-Path $framework 'csc.exe') @mailToolsArguments
if($LASTEXITCODE -ne 0) { throw 'Mail tools test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'MailToolsTests.exe.config') -Force
& (Join-Path $out 'MailToolsTests.exe') --data-dir (Join-Path $out ('test-data\mail-tools-' + [guid]::NewGuid().ToString())) --offline-preview
if($LASTEXITCODE -ne 0) { throw 'Mail tools integration tests failed.' }
$profileArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'LauncherProfileTests.exe')),('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach($reference in @('System.dll','System.Core.dll','System.Web.Extensions.dll','System.Xaml.dll','WPF\WindowsBase.dll','WPF\PresentationCore.dll','WPF\PresentationFramework.dll')) { $profileArguments += '/reference:' + (Join-Path $framework $reference) }
$profileArguments += Join-Path $PSScriptRoot 'tests\LauncherProfileTests.cs'
& (Join-Path $framework 'csc.exe') @profileArguments
if($LASTEXITCODE -ne 0) { throw 'Launcher profile test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'LauncherProfileTests.exe.config') -Force
$suiteProfileFixture=Join-Path $out ('test-data\suite-profile-'+[guid]::NewGuid().ToString('N'))
& (Join-Path $out 'LauncherProfileTests.exe') --data-dir $suiteProfileFixture --launcher-profile (Join-Path $suiteProfileFixture 'suite-profile.json') --offline-preview
if($LASTEXITCODE -ne 0) { throw 'Launcher profile sync checks failed.' }

$startupArguments = @('/nologo','/target:exe',('/out:' + (Join-Path $out 'StartupTests.exe')),('/reference:' + (Join-Path $out 'TMA-Mail.exe')))
foreach($reference in @('System.dll','System.Core.dll','System.Xaml.dll','WPF\WindowsBase.dll','WPF\PresentationCore.dll','WPF\PresentationFramework.dll')) { $startupArguments += '/reference:' + (Join-Path $framework $reference) }
$startupArguments += Join-Path $PSScriptRoot 'tests\StartupTests.cs'
& (Join-Path $framework 'csc.exe') @startupArguments
if($LASTEXITCODE -ne 0) { throw 'Startup test compilation failed.' }
Copy-Item -LiteralPath (Join-Path $out 'TMA-Mail.exe.config') -Destination (Join-Path $out 'StartupTests.exe.config') -Force
& (Join-Path $out 'StartupTests.exe') --data-dir (Join-Path $out ('test-data\startup-' + [guid]::NewGuid().ToString())) --offline-preview
if($LASTEXITCODE -ne 0) { throw 'Startup loading screen checks failed.' }
& (Join-Path $out 'StartupTests.exe') --data-dir (Join-Path $out ('test-data\full-startup-' + [guid]::NewGuid().ToString())) --offline-preview --full-startup
if($LASTEXITCODE -ne 0) { throw 'Full startup handoff checks failed.' }
& (Join-Path $out 'StartupTests.exe') --data-dir (Join-Path $out ('test-data\minimized-startup-' + [guid]::NewGuid().ToString())) --offline-preview --full-startup --start-minimized-test
if($LASTEXITCODE -ne 0) { throw 'Start-minimized handoff checks failed.' }& (Join-Path $out 'StartupTests.exe') --data-dir (Join-Path $out ('test-data\welcome-startup-' + [guid]::NewGuid().ToString())) --offline-preview --full-startup --welcome-startup-test
if($LASTEXITCODE -ne 0) { throw 'Welcome startup handoff checks failed.' }
