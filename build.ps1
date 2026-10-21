param([switch]$Test, [switch]$Package)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (!(Test-Path 'node_modules')) { throw 'Run pnpm install --frozen-lockfile first. The rebuilt desktop app uses Electron.' }
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    if ($Test) {
        & pnpm test
        if ($LASTEXITCODE -ne 0) { throw 'Storage/format checks failed.' }
        & pnpm test:ui
        if ($LASTEXITCODE -ne 0) { throw 'Desktop checks failed.' }
    }
    if ($Package) {
        & pnpm exec electron-builder --win zip --x64 --publish never
        if ($LASTEXITCODE -ne 0) { throw 'Windows package failed.' }
    }
    Write-Output 'Desktop build ready. Run pnpm start, or open a verified package under release/.'
} finally { Pop-Location }
