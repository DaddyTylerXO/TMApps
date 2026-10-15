param([ValidateSet('status', 'toggle', 'next', 'previous')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
  $taskAwaiter = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  function Wait-WinRT($operation, [Type]$resultType) {
    $task = $taskAwaiter.MakeGenericMethod($resultType).Invoke($null, @($operation))
    if (-not $task.Wait(5000)) { throw 'Spotify media request timed out.' }
    return $task.Result
  }
  $manager = Wait-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match 'Spotify' } | Select-Object -First 1
  if (-not $session) { @{ supported = $true; available = $false; title = ''; artist = ''; message = 'Open Spotify and play a track to connect.' } | ConvertTo-Json -Compress; exit 0 }
  if ($Action -ne 'status') {
    $operation = switch ($Action) { 'toggle' { $session.TryTogglePlayPauseAsync() } 'next' { $session.TrySkipNextAsync() } 'previous' { $session.TrySkipPreviousAsync() } }
    $accepted = Wait-WinRT $operation ([bool])
    if (-not $accepted) { throw 'Spotify declined this playback command.' }
  }
  $media = Wait-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $playback = $session.GetPlaybackInfo()
  @{ supported = $true; available = $true; title = $media.Title; artist = $media.Artist; album = $media.AlbumTitle; playing = ($playback.PlaybackStatus.ToString() -eq 'Playing'); canToggle = ($playback.Controls.IsPlayEnabled -or $playback.Controls.IsPauseEnabled); canNext = $playback.Controls.IsNextEnabled; canPrevious = $playback.Controls.IsPreviousEnabled; message = '' } | ConvertTo-Json -Compress
} catch {
  @{ supported = $false; available = $false; message = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 0
}
