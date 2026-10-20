param([string]$OutputDirectory = 'build')
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot $OutputDirectory
New-Item -ItemType Directory -Force $out | Out-Null
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$wpf = Join-Path $framework 'WPF'
$refs = @('System.dll','System.Core.dll','System.Security.dll','System.Windows.Forms.dll','System.Drawing.dll','System.Net.Http.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','System.Xaml.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
$refs += @('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll') | ForEach-Object { '/reference:' + (Join-Path $wpf $_) }
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ "/win32manifest:$PSScriptRoot\assets\app.manifest" "/out:$out\TMApps-Launcher.exe" "/win32icon:$PSScriptRoot\assets\TMApps-Launcher.ico" @refs "/resource:$PSScriptRoot\assets\TMApps-Launcher.ico,TMApps.launcher.ico" "/resource:$PSScriptRoot\assets\TMA-Mail.png,TMApps.mail.png" "/resource:$PSScriptRoot\assets\TMA-Padlock.png,TMApps.padlock.png" "/resource:$PSScriptRoot\assets\TMA-Safe.png,TMApps.safe.png" "/resource:$PSScriptRoot\src\MainWindow.xaml,TMApps.MainWindow.xaml" "/resource:$PSScriptRoot\catalog.json,TMApps.catalog.json" "$PSScriptRoot\src\Core.cs" "$PSScriptRoot\src\SuiteProfile.cs" "$PSScriptRoot\src\SelfUpdate.cs" "$PSScriptRoot\src\AppLifecycle.cs" "$PSScriptRoot\src\ThemedDialogs.cs" "$PSScriptRoot\src\DesktopIntegration.cs" "$PSScriptRoot\src\App.cs"
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Write-Host "Built standalone $out\TMApps-Launcher.exe"
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ "/win32manifest:$PSScriptRoot\assets\app.manifest" "/out:$out\TMApps-Launcher-Setup.exe" "/win32icon:$PSScriptRoot\assets\TMApps-Launcher.ico" @refs "/resource:$out\TMApps-Launcher.exe,TMApps.payload.exe" "/resource:$PSScriptRoot\assets\TMApps-Launcher.ico,TMApps.launcher.ico" "$PSScriptRoot\src\Core.cs" "$PSScriptRoot\src\SuiteProfile.cs" "$PSScriptRoot\src\SelfUpdate.cs" "$PSScriptRoot\src\AppLifecycle.cs" "$PSScriptRoot\src\ThemedDialogs.cs" "$PSScriptRoot\src\DesktopIntegration.cs" "$PSScriptRoot\src\Setup.cs"
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Write-Host "Built installer $out\TMApps-Launcher-Setup.exe"
