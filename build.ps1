param([string]$OutputDirectory = 'build\v0.10.0')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'
$out = Join-Path $root $OutputDirectory
& (Join-Path $root 'restore.ps1')
New-Item -ItemType Directory -Path $out -Force | Out-Null
$references = @('System.dll', 'System.Core.dll', 'System.Windows.Forms.dll', 'System.Drawing.dll', 'System.Xaml.dll', 'System.Web.Extensions.dll', 'WPF\System.Speech.dll', 'WPF\WindowsBase.dll', 'WPF\PresentationCore.dll', 'WPF\PresentationFramework.dll')
$arguments = @('/nologo', '/target:winexe', '/optimize+', ('/out:' + (Join-Path $out 'TMA-Mail.exe')))
$arguments += '/win32icon:' + (Join-Path $root 'assets\TMA-Mail.ico')
$arguments += '/resource:' + (Join-Path $root 'assets\TMA-Mail.ico') + ',TMA-Mail.ico'
$arguments += '/reference:' + (Join-Path $framework 'System.Security.dll')
$arguments += '/reference:' + (Join-Path $framework 'System.Net.Http.dll')
foreach ($source in @('AppBrand','Accounts','MailTransport','ConnectedUi','MailHtml','ProviderSetup','ProviderLogin')) { $arguments += Join-Path $root ('src\' + $source + '.cs') }
foreach ($source in @('SyncTransport','LiveMail','AccountWorkspace','HtmlMessageView','FolderFeatures','Sounds','SuiteUi','SuiteServices','CalendarFeatures','Subscriptions')) { $arguments += Join-Path $root ('src\' + $source + '.cs') }
foreach ($package in Get-ChildItem (Join-Path $root 'packages') -Directory) {
    $dll = Get-ChildItem (Join-Path $package.FullName 'lib\net462') -Filter *.dll -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$dll) { $dll = Get-ChildItem (Join-Path $package.FullName 'lib\net461') -Filter *.dll -ErrorAction SilentlyContinue | Select-Object -First 1 }
    if (!$dll) { $dll = Get-ChildItem (Join-Path $package.FullName 'lib\net45') -Filter *.dll -ErrorAction SilentlyContinue | Select-Object -First 1 }
    if ($dll) { $arguments += '/reference:' + $dll.FullName; Copy-Item -LiteralPath $dll.FullName -Destination $out -Force }
}
foreach ($library in @('Microsoft.Web.WebView2.Wpf.dll','Microsoft.Web.WebView2.Core.dll')) { $source = Join-Path $root ('packages\microsoft.web.webview2\lib\net462\' + $library); $arguments += '/reference:' + $source; Copy-Item -LiteralPath $source -Destination $out -Force }
Copy-Item -LiteralPath (Join-Path $root 'packages\microsoft.web.webview2\runtimes\win-x64\native\WebView2Loader.dll') -Destination $out -Force
foreach ($library in @(@("ical.net","Ical.Net.dll"),@("nodatime","NodaTime.dll"))) { $file = Join-Path $root ("packages\" + $library[0] + "\lib\netstandard2.0\" + $library[1]); $arguments += "/reference:" + $file; Copy-Item -LiteralPath $file -Destination $out -Force }
$netstandard = Get-ChildItem (Join-Path $env:WINDIR "Microsoft.NET\assembly\GAC_MSIL\netstandard") -Recurse -Filter netstandard.dll | Select-Object -First 1 -ExpandProperty FullName
$arguments += "/reference:" + $netstandard
$arguments += "/reference:" + (Join-Path $framework "WPF\ReachFramework.dll")
$arguments += "/reference:" + (Join-Path $framework "WPF\System.Printing.dll")
foreach ($reference in $references) { $arguments += '/reference:' + (Join-Path $framework $reference) }
$arguments += (Join-Path $root 'src\MailStore.cs')
$arguments += (Join-Path $root 'src\App.cs')
$arguments += (Join-Path $root 'src\Settings.cs')
$arguments += (Join-Path $root 'src\SettingsUi.cs')
$arguments += (Join-Path $root 'src\Theme.cs')
$arguments += (Join-Path $root 'src\MailboxFeatures.cs')
$arguments += (Join-Path $root 'src\Composer.cs')
$arguments += (Join-Path $root 'src\ComposerVisuals.cs')
$arguments += (Join-Path $root 'src\SignatureEditor.cs')
$arguments += (Join-Path $root 'src\WorkspaceFeatures.cs')
$arguments += (Join-Path $root 'src\Spotify.cs')
$arguments += (Join-Path $root 'src\Startup.cs')
foreach ($assemblyName in @('System.Runtime', 'System.Threading.Tasks', 'System.Runtime.InteropServices.WindowsRuntime')) {
    $assemblyPath = Get-ChildItem (Join-Path (Join-Path $env:WINDIR 'Microsoft.NET\assembly\GAC_MSIL') $assemblyName) -Recurse -Filter ($assemblyName + '.dll') | Select-Object -First 1 -ExpandProperty FullName
    $arguments += '/reference:' + $assemblyPath
}
foreach ($metadata in @('Windows.Foundation.winmd', 'Windows.Media.winmd', 'Windows.Storage.winmd')) { $arguments += '/reference:' + (Join-Path $env:WINDIR ('System32\WinMetadata\' + $metadata)) }
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
Copy-Item -LiteralPath (Join-Path $root 'src\MainWindow.xaml') -Destination $out -Force
Copy-Item -LiteralPath (Join-Path $root 'src\TMA-Mail.exe.config') -Destination $out -Force
foreach ($document in @('SETUP.md','README.md')) { Copy-Item -LiteralPath (Join-Path $root $document) -Destination $out -Force }
$providerConfig = Join-Path $root 'provider-settings.json'
if (!(Test-Path $providerConfig)) { $providerConfig = Join-Path $root 'provider-settings.example.json' }
Copy-Item -LiteralPath $providerConfig -Destination (Join-Path $out 'provider-settings.json') -Force
Copy-Item -LiteralPath (Join-Path $root "assets\Sounds") -Destination $out -Recurse -Force
Write-Host "Built $out\TMA-Mail.exe"
