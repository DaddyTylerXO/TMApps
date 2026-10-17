$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path $root ('build\secret-scan-fixture-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
$scanner = Join-Path $root 'check-secrets.ps1'
$emptyConfig = Join-Path $fixture 'empty.json'
[IO.File]::WriteAllText($emptyConfig,'{}')
$checks = 0
function Reject([string]$path, [string]$config = $emptyConfig) {
    $rejected = $false
    try { & $scanner -Paths @($path) -LocalProviderConfig $config | Out-Null }
    catch { if ($_.Exception.Message -match '(blocked|scan limit)') { $rejected = $true } else { throw } }
    if (!$rejected) { throw 'Credential fixture was not rejected' }
    $script:checks++
}
$safe = Join-Path $fixture 'safe.json'
[IO.File]::WriteAllText($safe,'{"GmailDesktopClientSecret":"","OutlookClientId":"00000000-0000-0000-0000-000000000001"}')
& $scanner -Paths @($safe) -LocalProviderConfig $emptyConfig | Out-Null
$checks++
$secretFile = Join-Path $fixture 'literal.json'
[IO.File]::WriteAllText($secretFile,(@{ AzureClientSecret = ('live-value-' + [guid]::NewGuid().ToString('N')) } | ConvertTo-Json))
Reject $secretFile
$googleFile = Join-Path $fixture 'google.txt'
[IO.File]::WriteAllText($googleFile,('GOCSPX-' + ('A' * 30)))
Reject $googleFile
$unicodeFile = Join-Path $fixture 'unicode.txt'
[IO.File]::WriteAllText($unicodeFile,('GOCSPX-' + ('B' * 30)),[Text.Encoding]::Unicode)
Reject $unicodeFile
$configFile = Join-Path $fixture 'local.json'
$unique = 'fixture-value-' + [guid]::NewGuid().ToString('N')
[IO.File]::WriteAllText($configFile,('{"GmailDesktopClientSecret":"' + $unique + '"}'))
$encodedFile = Join-Path $fixture 'encoded.txt'
[IO.File]::WriteAllText($encodedFile,[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($unique)))
Reject $encodedFile $configFile
$privateFile = Join-Path $fixture 'accounts.protected'
[IO.File]::WriteAllText($privateFile,'fixture only')
Reject $privateFile
$archive = Join-Path $fixture 'archive.zip'
Compress-Archive -LiteralPath $googleFile -DestinationPath $archive
Reject $archive
$nested = Join-Path $fixture 'nested.zip'
Compress-Archive -LiteralPath $archive -DestinationPath $nested
Reject $nested
Write-Output ('Passed ' + $checks + ' secret-scan checks: safe public config, client-secret literals, credential patterns, Unicode/base64, private artifacts and nested ZIPs. Synthetic fixtures only.')
