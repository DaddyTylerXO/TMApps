param(
    [string]$RepositoryPath = $PSScriptRoot,
    [string]$Revision = 'HEAD',
    [switch]$Outgoing,
    [string[]]$Paths = @(),
    [string]$LocalProviderConfig = (Join-Path $PSScriptRoot 'provider-settings.json')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$script:checkedFiles = 0
$script:archiveFiles = 0
$knownValues = @()
if (Test-Path -LiteralPath $LocalProviderConfig) {
    $local = Get-Content -LiteralPath $LocalProviderConfig -Raw | ConvertFrom-Json
    foreach ($property in $local.PSObject.Properties) {
        if ($property.Name -match '(?i)secret' -and $property.Value) {
            $knownValues += [string]$property.Value
            $knownValues += [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$property.Value))
        }
    }
}
function IsPlaceholder([string]$value) {
    return $value -match '^(YOUR[-_ ]|synthetic[-_]|fake[-_]|test[-_]|example[-_]|<)' -or $value -in @('app-password','secret','desktop-secret')
}
function CheckContent([byte[]]$bytes, [string]$label, [int]$depth = 0) {
    if ($depth -gt 4) { throw ('Archive nesting exceeds scan limit: ' + $label) }
    if ($label -match '(?i)(\.protected$|\.pfx$|\.p12$|\.pem$|(^|[/\\])\.env$|(^|[/\\])accounts\.json$|(^|[/\\])token\.json$|(^|[/\\])client_secret[^/\\]*\.json$|GoogleLiveCheck|test-data[/\\])') { throw ('Private credential/test artifact blocked: ' + $label) }
    foreach ($encoding in @([Text.Encoding]::UTF8, [Text.Encoding]::Unicode, [Text.Encoding]::BigEndianUnicode)) {
        $text = $encoding.GetString($bytes)
        foreach ($value in $knownValues) { if ($text.Contains($value)) { throw ('Known local secret blocked: ' + $label) } }
        foreach ($pattern in @('GOCSPX-[A-Za-z0-9_-]{20,}', 'gh[pousr]_[A-Za-z0-9]{30,}', 'github_pat_[A-Za-z0-9_]{50,}', '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/]{32,}')) {
            if ($text -match $pattern) { throw ('Credential pattern blocked: ' + $label) }
        }
        $assignments = [regex]::Matches($text, '(?i)["'']?([a-z0-9_]*(?:client_?secret|desktopclientsecret))["'']?\s*[:=]\s*["'']([^"''\r\n]+)["'']')
        foreach ($assignment in $assignments) {
            if (!(IsPlaceholder $assignment.Groups[2].Value)) { throw ('Nonempty client-secret literal blocked: ' + $label) }
        }
    }
    if ($bytes.Length -gt 4 -and $bytes[0] -eq 80 -and $bytes[1] -eq 75 -and $bytes[2] -eq 3 -and $bytes[3] -eq 4) {
        $memory = New-Object IO.MemoryStream(,$bytes)
        $zip = New-Object IO.Compression.ZipArchive($memory,[IO.Compression.ZipArchiveMode]::Read)
        try {
            foreach ($entry in $zip.Entries) {
                if (!$entry.Name) { continue }
                $stream = $entry.Open(); $data = New-Object IO.MemoryStream
                try { $stream.CopyTo($data); CheckContent $data.ToArray() ($label + '/' + $entry.FullName) ($depth + 1); $script:archiveFiles++ }
                finally { $stream.Dispose(); $data.Dispose() }
            }
        } finally { $zip.Dispose(); $memory.Dispose() }
    }
    $script:checkedFiles++
}
function ReadBlob([string]$oid) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = 'git'; $info.Arguments = '-C "' + [IO.Path]::GetFullPath($RepositoryPath) + '" cat-file blob ' + $oid
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($info); $data = New-Object IO.MemoryStream
    try { $process.StandardOutput.BaseStream.CopyTo($data); $process.WaitForExit(); if ($process.ExitCode -ne 0) { throw 'Git blob read failed' }; return ,$data.ToArray() }
    finally { $data.Dispose(); $process.Dispose() }
}
if ($Paths.Count) {
    foreach ($path in $Paths) { CheckContent ([IO.File]::ReadAllBytes([IO.Path]::GetFullPath($path))) $path }
} else {
    $gitArgs = @('-C',$RepositoryPath,'rev-list','--objects',$Revision)
    if ($Outgoing) { $gitArgs += @('--not','--remotes') }
    $objects = @(& git @gitArgs)
    if ($LASTEXITCODE -ne 0) { throw 'Git history enumeration failed' }
    foreach ($object in $objects) {
        $parts = $object -split ' ',2
        $kind = git -C $RepositoryPath cat-file -t $parts[0]
        if ($LASTEXITCODE -ne 0) { throw 'Git object inspection failed' }
        if ($kind -eq 'blob') {
            $label = if ($parts.Count -gt 1) { $parts[1] } else { $parts[0] }
            CheckContent (ReadBlob $parts[0]) $label
        }
    }
}
Write-Output ('Secret scan passed: ' + $script:checkedFiles + ' files/blobs, including ' + $script:archiveFiles + ' decompressed archive entries. Secret values are never printed.')
