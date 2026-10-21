$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$directories = @('src','app','desktop','tests','scripts') | ForEach-Object { Join-Path $root $_ }
$files = @(Get-ChildItem $directories -File -Recurse | Where-Object { $_.Extension -in '.cs','.ps1','.py','.config','.mjs','.cjs','.ts','.tsx','.css' })
$patterns = @('-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----', '\bgh[pousr]_[A-Za-z0-9]{30,}\b', '\bgithub_pat_[A-Za-z0-9_]{30,}\b', '\bAKIA[A-Z0-9]{16}\b', '\bsk-[A-Za-z0-9_-]{32,}\b')
$matches = @($files | Select-String -Pattern $patterns)
if ($matches.Count) { throw 'Potential credential detected. Review locally before sharing source.' }
Write-Output "Credential pattern scan passed across $($files.Count) source/test/script files. This is a bounded pattern scan, not a full security audit."
