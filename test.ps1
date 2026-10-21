$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\build.ps1"
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$wpf = Join-Path $framework 'WPF'
$refs = @('System.dll','System.Core.dll','System.Security.dll','System.Windows.Forms.dll','System.Drawing.dll','System.Net.Http.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','System.Xaml.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
$refs += @('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll') | ForEach-Object { '/reference:' + (Join-Path $wpf $_) }
& "$framework\csc.exe" /nologo /target:exe /platform:x64 "/out:$PSScriptRoot\build\Launcher.Tests.exe" @refs "/resource:$PSScriptRoot\assets\TMApps-Launcher.ico,TMApps.launcher.ico" "/resource:$PSScriptRoot\assets\TMA-Finance.png,TMApps.finance.png" "/resource:$PSScriptRoot\assets\TMA-Libraries.png,TMApps.libraries.png" "/resource:$PSScriptRoot\assets\TMA-Cut.png,TMApps.cut.png" "/resource:$PSScriptRoot\assets\TMA-Mail.png,TMApps.mail.png" "/resource:$PSScriptRoot\assets\TMA-Padlock.png,TMApps.padlock.png" "/resource:$PSScriptRoot\assets\TMA-Safe.png,TMApps.safe.png" "/resource:$PSScriptRoot\assets\TMA-SocialsManager.png,TMApps.socials.png" "/resource:$PSScriptRoot\content\experience.json,TMApps.experience.json" "/resource:$PSScriptRoot\content\auth-config.json,TMApps.auth-config.json" "/resource:$PSScriptRoot\src\MainWindow.xaml,TMApps.MainWindow.xaml" "/resource:$PSScriptRoot\catalog.json,TMApps.catalog.json" "$PSScriptRoot\src\Core.cs" "$PSScriptRoot\src\SuiteProfile.cs" "$PSScriptRoot\src\SelfUpdate.cs" "$PSScriptRoot\src\AppLifecycle.cs" "$PSScriptRoot\src\ThemedDialogs.cs" "$PSScriptRoot\src\DesktopIntegration.cs" "$PSScriptRoot\src\Experience.cs" "$PSScriptRoot\src\SuiteSignIn.cs" "$PSScriptRoot\src\App.cs" "$PSScriptRoot\tests\Tests.cs" /main:TMApps.Tests
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
& "$PSScriptRoot\build\Launcher.Tests.exe" $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw 'Launcher tests failed' }

$performanceReport = Join-Path $PSScriptRoot 'build/windows-performance.json'
$benchmark = Start-Process -FilePath "$PSScriptRoot\build\TMApps-Launcher.exe" -ArgumentList @('--verify-performance',('"'+$performanceReport+'"')) -WindowStyle Hidden -PassThru
if (-not $benchmark.WaitForExit(30000)) { $benchmark.Kill(); throw 'Launcher resource check timed out.' }
if ($benchmark.ExitCode -ne 0) { throw 'Launcher resource budget exceeded.' }
Get-Content $performanceReport
