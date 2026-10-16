$ErrorActionPreference = 'Stop'
$packages = @('MailKit/4.17.0','MimeKit/4.17.0','System.Formats.Asn1/8.0.1','System.Threading.Tasks.Extensions/4.6.3','System.Buffers/4.6.1','System.Memory/4.6.3','BouncyCastle.Cryptography/2.6.2','System.Runtime.CompilerServices.Unsafe/6.1.2','System.Numerics.Vectors/4.6.1','System.ValueTuple/4.5.0')
foreach ($package in $packages) {
    $parts = $package.ToLowerInvariant().Split('/')
    $folder = Join-Path $PSScriptRoot ('packages\' + $parts[0])
    if (Test-Path (Join-Path $folder ($parts[0] + '.nuspec'))) { continue }
    New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'packages') | Out-Null
    $archive = Join-Path $PSScriptRoot ('packages\' + $parts[0] + '.zip')
    Invoke-WebRequest -Uri ('https://api.nuget.org/v3-flatcontainer/' + $package.ToLowerInvariant() + '/' + $parts[0] + '.' + $parts[1] + '.nupkg') -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $folder -Force
}
