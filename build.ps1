param([string]$OutputDirectory = 'build\v0.7-release')
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
foreach ($source in @('AppBrand','Accounts','MailTransport','ConnectedUi','MailHtml')) { $arguments += Join-Path $root ('src\' + $source + '.cs') }
foreach ($package in Get-ChildItem (Join-Path $root 'packages') -Directory) {
    $dll = Get-ChildItem (Join-Path $package.FullName 'lib\net462') -Filter *.dll -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$dll) { $dll = Get-ChildItem (Join-Path $package.FullName 'lib\net461') -Filter *.dll -ErrorAction SilentlyContinue | Select-Object -First 1 }
    if ($dll) { $arguments += '/reference:' + $dll.FullName; Copy-Item -LiteralPath $dll.FullName -Destination $out -Force }
}
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
Write-Host "Built $out\TMA-Mail.exe"
