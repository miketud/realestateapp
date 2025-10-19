param(
  [string] $Username = 'miketud',
  [string] $Project  = 'realestateapp',
  [switch] $NoCache,
  [switch] $Watch,
  [string] $Version
)

$ErrorActionPreference = 'Stop'

function New-Tag {
  param([string]$Tag)
  if ($Tag) { return $Tag }
  $ts  = (Get-Date -Format 'yyyyMMdd-HHmmss')
  $sha = ''
  try { $sha = (git rev-parse --short HEAD).Trim() } catch { $sha = 'nogit' }
  return "$ts-$sha"
}

function Invoke-ImageRelease {
  param([string]$Tag)

  Write-Host "[LOGIN] docker login (cached session is OK)..."
  docker login | Out-Host

  $buildArgs = @('compose','build','--pull')
  if ($NoCache) { $buildArgs += '--no-cache' }
  Write-Host "[BUILD] docker $($buildArgs -join ' ')"
  docker @buildArgs | Out-Host

  # Resolve actual local image names produced by compose
  $beLocal = ''
  $feLocal = ''
  try {
    $beLocal = (docker compose images backend  --format json | ConvertFrom-Json).Image
    $feLocal = (docker compose images frontend --format json | ConvertFrom-Json).Image
  } catch {
    $beLocal = "${Project}-backend:latest"
    $feLocal = "${Project}-frontend:latest"
  }
  if (-not $beLocal) { $beLocal = "${Project}-backend:latest" }
  if (-not $feLocal) { $feLocal = "${Project}-frontend:latest" }

  $beRemoteLatest = "${Username}/realestateapp-backend:latest"
  $beRemoteVer    = "${Username}/realestateapp-backend:${Tag}"
  $feRemoteLatest = "${Username}/realestateapp-frontend:latest"
  $feRemoteVer    = "${Username}/realestateapp-frontend:${Tag}"

  Write-Host "[TAG]   backend: $beLocal -> $beRemoteLatest, $beRemoteVer"
  docker tag $beLocal $beRemoteLatest
  docker tag $beLocal $beRemoteVer

  Write-Host "[TAG]   frontend: $feLocal -> $feRemoteLatest, $feRemoteVer"
  docker tag $feLocal $feRemoteLatest
  docker tag $feLocal $feRemoteVer

  Write-Host "[PUSH]  backend..."
  docker push $beRemoteLatest  | Out-Host
  docker push $beRemoteVer     | Out-Host

  Write-Host "[PUSH]  frontend..."
  docker push $feRemoteLatest  | Out-Host
  docker push $feRemoteVer     | Out-Host

  Write-Host "[DONE]  pushed:"
  Write-Host "        $beRemoteLatest"
  Write-Host "        $beRemoteVer"
  Write-Host "        $feRemoteLatest"
  Write-Host "        $feRemoteVer"
}

function Start-FileWatch {
  # Watch common project paths; adjust if needed
  $paths = @()
  if (Test-Path './frontend/src') { $paths += (Resolve-Path './frontend/src').Path }
  if (Test-Path './backend/node')  { $paths += (Resolve-Path './backend/node').Path }

  if ($paths.Count -eq 0) {
    Write-Host "[WATCH] No watch paths found; exiting watch mode."
    return
  }

  Write-Host "[WATCH] Watching for changes:"
  $paths | ForEach-Object { Write-Host "        $_" }

  $subs = @()
  foreach ($p in $paths) {
    $w = New-Object System.IO.FileSystemWatcher $p
    $w.Filter = '*.*'
    $w.IncludeSubdirectories = $true
    $w.EnableRaisingEvents = $true
    foreach ($ev in 'Changed','Created','Deleted','Renamed') {
      $subs += Register-ObjectEvent -InputObject $w -EventName $ev -SourceIdentifier "fsw-$p-$ev"
    }
  }

  # Debounce timer: 2 seconds after last change
  $debounce = New-Object System.Timers.Timer
  $debounce.Interval = 2000
  $debounce.AutoReset = $false
  Register-ObjectEvent -InputObject $debounce -EventName Elapsed -SourceIdentifier 'debounced-build' | Out-Null

  Write-Host "[WATCH] Waiting for changes (Ctrl+C to stop)..."
  while ($true) {
    $e = Wait-Event
    if ($e.SourceIdentifier -like 'fsw-*') {
      $debounce.Stop(); $debounce.Start()
    }
    elseif ($e.SourceIdentifier -eq 'debounced-build') {
      try {
        $tag = New-Tag -Tag $Version
        Write-Host "[WATCH] Change detected -> build/tag/push as $tag"
        Invoke-ImageRelease -Tag $tag
      } catch {
        Write-Host "[ERROR] Release failed: $($_.Exception.Message)"
      }
    }
    Remove-Event $e.EventIdentifier
  }
}

# ----- entrypoint -----
$tagToUse = New-Tag -Tag $Version
if ($Watch) {
  Start-FileWatch
} else {
  Invoke-ImageRelease -Tag $tagToUse
}
