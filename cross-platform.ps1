param(
    [ValidateSet('Check','Run','Publish')][string]$Mode = 'Check',
    [string]$RuntimeIdentifier,
    [string]$OutputDirectory = 'build/cross-platform'
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$local = Join-Path $root ('build/tools/dotnet/' + $(if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'dotnet.exe' } else { 'dotnet' }))
$dotnet = if (Test-Path -LiteralPath $local) { $local } else { (Get-Command dotnet -ErrorAction Stop).Source }
if (!$env:DOTNET_CLI_HOME) { $env:DOTNET_CLI_HOME = Join-Path $root 'build/dotnet-home' }
if (!$env:NUGET_PACKAGES) { $env:NUGET_PACKAGES = Join-Path $root 'build/nuget-cache' }
$env:DOTNET_NOLOGO = '1'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$output = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Path $output -Force | Out-Null
Push-Location (Join-Path $root 'cross-platform')
try {
    & $dotnet restore TmaMail.Checks/TmaMail.Checks.csproj --locked-mode
    if ($LASTEXITCODE -ne 0) { throw 'Portable dependency restore failed.' }
    & $dotnet build TmaMail.Checks/TmaMail.Checks.csproj -c Release --no-restore -m:1 -nr:false -p:UseSharedCompilation=false
    if ($LASTEXITCODE -ne 0) { throw 'Portable build failed.' }
    if ($Mode -eq 'Run') {
        & $dotnet run --project TmaMail.Desktop/TmaMail.Desktop.csproj -c Release --no-build
        if ($LASTEXITCODE -ne 0) { throw 'Portable preview failed.' }
        return
    }
    & $dotnet run --project TmaMail.Checks/TmaMail.Checks.csproj -c Release --no-build -- (Join-Path $output 'checks')
    if ($LASTEXITCODE -ne 0) { throw 'Portable checks failed.' }
    if ($Mode -eq 'Publish') {
        if (!$RuntimeIdentifier) { $RuntimeIdentifier = [Runtime.InteropServices.RuntimeInformation]::RuntimeIdentifier }
        if ($RuntimeIdentifier -notin @('win-x64','osx-arm64','osx-x64','linux-x64','linux-arm64')) { throw 'Unsupported preview runtime.' }
        $publish = Join-Path $output $RuntimeIdentifier
        & $dotnet publish TmaMail.Desktop/TmaMail.Desktop.csproj -c Release -r $RuntimeIdentifier --self-contained true -p:RestoreLockedMode=true -p:DebugType=None -o $publish
        if ($LASTEXITCODE -ne 0) { throw 'Portable preview publish failed.' }
        $native = Join-Path $publish $(if ($RuntimeIdentifier.StartsWith('win-')) { 'TmaMail.Desktop.exe' } else { 'TmaMail.Desktop' })
        $start = [Diagnostics.ProcessStartInfo]::new(); $start.WorkingDirectory = $publish; $start.UseShellExecute = $false; $start.CreateNoWindow = $true; $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
        if ($IsLinux) { $start.FileName = (Get-Command xvfb-run -ErrorAction Stop).Source; $start.ArgumentList.Add('-a'); $start.ArgumentList.Add($native) }
        else { $start.FileName = $native }
        $start.ArgumentList.Add('--smoke-test')
        $process = [Diagnostics.Process]::Start($start)
        if (!$process.WaitForExit(25000)) { $process.Kill($true); throw 'Native preview startup timed out.' }
        if ($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath (Join-Path $publish 'startup-evidence.json'))) { throw 'Native preview startup failed.' }
        $evidence = Get-Content -LiteralPath (Join-Path $publish 'startup-evidence.json') -Raw | ConvertFrom-Json
        if (!$evidence.NativeWindowOpened -or $evidence.SampleMessages -ne 2) { throw 'Native startup evidence is incomplete.' }
        Write-Host ('Native preview passed on ' + $evidence.OS + ' / ' + $evidence.Runtime + ': startup ' + $evidence.StartupMilliseconds + 'ms; working set ' + [Math]::Round($evidence.WorkingSetBytes / 1MB) + 'MB; one-second idle CPU ' + $evidence.IdleCpuMillisecondsOverOneSecond + 'ms.')
        Copy-Item -LiteralPath (Join-Path $root 'licenses') -Destination $publish -Recurse -Force
        Copy-Item -LiteralPath (Join-Path $root 'THIRD_PARTY.md') -Destination $publish -Force
        $config = Get-Content -LiteralPath (Join-Path $publish 'provider-settings.json') -Raw | ConvertFrom-Json
        if (![string]::IsNullOrWhiteSpace($config.GmailDesktopClientSecret)) { throw 'A public preview must not contain a Google client secret.' }
        $files = @(Get-ChildItem -LiteralPath $publish -Recurse -File | Select-Object -ExpandProperty FullName)
        & (Join-Path $root 'check-secrets.ps1') -Paths $files
        if ($RuntimeIdentifier.StartsWith('win-')) { Compress-Archive -Path (Join-Path $publish '*') -DestinationPath (Join-Path $output ('TMA-Mail-preview-' + $RuntimeIdentifier + '.zip')) -Force }
        else { & tar -czf (Join-Path $output ('TMA-Mail-preview-' + $RuntimeIdentifier + '.tar.gz')) -C $publish .; if ($LASTEXITCODE -ne 0) { throw 'Preview archive failed.' } }
    }
} finally { Pop-Location }
