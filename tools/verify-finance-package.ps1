param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$Executable=(Resolve-Path -LiteralPath $Executable).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory=(Resolve-Path -LiteralPath $OutputDirectory).Path
$qaDirectory=Join-Path $OutputDirectory ('finance-qa-'+[Guid]::NewGuid().ToString('N'))
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start();$qaPort=$listener.LocalEndpoint.Port;$listener.Stop()
$oldDirectory=$env:TMA_TEST_DATA_DIR
$appProcess=$null
$packageDirectory=[IO.Path]::GetDirectoryName($Executable)+[IO.Path]::DirectorySeparatorChar
function AppFamily {
    $family=@($appProcess.Id)
    $all=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
    do { $added=@($all | Where-Object {$_.ParentProcessId -in $family -and $_.ProcessId -notin $family} | ForEach-Object ProcessId);$family+=$added } while($added.Count -gt 0)
    @(foreach($processId in $family) { $candidate=Get-Process -Id $processId -ErrorAction SilentlyContinue; if($candidate -and $candidate.Path -and $candidate.Path.StartsWith($packageDirectory,[StringComparison]::OrdinalIgnoreCase)){$candidate} })
}
try {
    $env:TMA_TEST_DATA_DIR=$qaDirectory
    $watch=[Diagnostics.Stopwatch]::StartNew()
    $appProcess=Start-Process -FilePath $Executable -ArgumentList @("--remote-debugging-port=$qaPort",'--remote-debugging-address=127.0.0.1') -WindowStyle Hidden -PassThru
    $env:TMA_TEST_DATA_DIR=$oldDirectory
    & node (Join-Path $PSScriptRoot 'verify-finance-window.cjs') $qaPort (Join-Path $OutputDirectory 'finance-preview.png')
    if($LASTEXITCODE -ne 0){throw 'Packaged Finance window verification failed'}
    $startupMs=$watch.ElapsedMilliseconds
    $before=@{};foreach($item in (AppFamily)){$before[$item.Id]=$item.TotalProcessorTime.TotalMilliseconds}
    $idleWatch=[Diagnostics.Stopwatch]::StartNew();Start-Sleep -Milliseconds 2000
    $family=@(AppFamily);$cpuMs=0.0;$memoryBytes=0.0
    foreach($item in $family){$memoryBytes+=$item.WorkingSet64;if($before.ContainsKey($item.Id)){$cpuMs+=[Math]::Max(0,$item.TotalProcessorTime.TotalMilliseconds-$before[$item.Id])}}
    $idleCpu=$cpuMs/$idleWatch.ElapsedMilliseconds/[Environment]::ProcessorCount*100
    $report=[ordered]@{passed=($startupMs -lt 30000 -and $memoryBytes/1MB -lt 800 -and $idleCpu -lt 30);startupMs=$startupMs;workingSetMb=[Math]::Round($memoryBytes/1MB,2);idleCpuPercent=[Math]::Round($idleCpu,2);rendererIsolated=$true;disposableProfile=$true}
    $report | ConvertTo-Json | Set-Content (Join-Path $OutputDirectory 'finance-performance.json') -Encoding UTF8
    if(-not $report.passed){throw 'Finance exceeded packaged startup/idle resource budgets'}
    $appProcess.Refresh()
    if(-not $appProcess.CloseMainWindow()) {
        & node (Join-Path $PSScriptRoot 'verify-finance-window.cjs') $qaPort '-' 'close'
        if($LASTEXITCODE -ne 0){throw 'Finance test window could not be closed'}
    }
    if(-not $appProcess.WaitForExit(10000)){throw 'Finance did not exit after its window closed'}
    $report | ConvertTo-Json -Compress
} finally {
    $env:TMA_TEST_DATA_DIR=$oldDirectory
    if($appProcess){foreach($item in @(AppFamily)) {if(-not $item.HasExited){Stop-Process -Id $item.Id -Force -ErrorAction SilentlyContinue}}}
}
