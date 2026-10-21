param([switch]$Test)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path $compiler)) { throw 'The Windows .NET Framework C# compiler is required.' }
$root = $PSScriptRoot
$out = Join-Path $root 'build'
New-Item -ItemType Directory -Force $out | Out-Null
$sources = @(Get-ChildItem (Join-Path $root 'src') -Filter '*.cs' | ForEach-Object FullName)
& $compiler /nologo /target:winexe /optimize+ /platform:anycpu /win32manifest:"$root/app.manifest" /win32icon:"$root/assets/app.ico" /out:"$out/TMA-Libraries.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Runtime.Serialization.dll $sources
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
Copy-Item (Join-Path $root 'src/TMA-Libraries.exe.config') $out
New-Item -ItemType Directory -Force (Join-Path $out 'docs') | Out-Null
$kb = Join-Path $root 'docs/TMA-Libraries KB Library.docx'
if (Test-Path $kb) { Copy-Item $kb (Join-Path $out 'docs') }
if ($Test) {
    & $compiler /nologo /target:exe /optimize+ /out:"$out/StorageChecks.exe" /reference:System.Runtime.Serialization.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll (Join-Path $root 'src/Model.cs') (Join-Path $root 'src/Store.cs') (Join-Path $root 'tests/StorageChecks.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
    & "$out/StorageChecks.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Storage checks failed.' }
    $smoke = Start-Process -FilePath "$out/TMA-Libraries.exe" -ArgumentList '--smoke' -Wait -PassThru -WindowStyle Hidden
    if ($smoke.ExitCode -ne 0) { throw 'Desktop smoke check failed.' }
}
Write-Output "Built $out/TMA-Libraries.exe"
