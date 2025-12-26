# ---------- run by: powershell -ExecutionPolicy Bypass -File .\push-latest.ps1
param(
  [string] $Username = 'miketud',
  [string] $Project  = 'realestateapp',
  [switch] $NoCache,
  [switch] $Watch
)

$ErrorActionPreference = 'Stop'

# -------------------------------------------------------------------------
# Build and push backend + frontend images using docker compose
# -------------------------------------------------------------------------
function Invoke-ImageRelease {

  Write-Host "[LOGIN] docker login (cached session OK)..."
  docker login | Out-Host

  # Compose build uses the same image tags defined in docker-compose.yml
  $buildArgs = @('compose','build','--pull')
  if ($NoCache) { $buildArgs += '--no-cache' }

  Write-Host "[BUILD] docker $($buildArgs -join ' ')"
  docker @buildArgs | Out-Host

  # Explicit image names (must match docker-compose.yml)
  $beImage = "${Username}/realestateapp-backend:latest"
  $feImage = "${Username}/realestateapp-frontend:latest"

  Write-Host "[PUSH]  backend..."
  docker push $beImage | Out-Host

  Write-Host "[PUSH]  frontend..."
  docker push $feImage | Out-Host

  Write-Host "`n[DONE] pushed successfully:"
  Write-Host "   $beImage"
  Write-Host "   $feImage"
}

# -------------------------------------------------------------------------
# File watcher mode (rebuild + push on changes)
# -------------------------------------------------------------------------
function Start-FileWatch {
  $paths = @()
  if (Test-Path './frontend/src') { $paths += (Resolve-Path './frontend/src').Path }
  if (Test-Path './backend/node')  { $paths += (Resolve-Path './backend/node').Path }

  if ($paths.Count -eq 0) {
    Write-Host "[WATCH] No watch paths found; exiting."
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

  # debounce 2s
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
        Write-Host "[WATCH] Change detected -> build and push latest"
        Invoke-ImageRelease
      } catch {
        Write-Host "[ERROR] Release failed: $($_.Exception.Message)"
      }
    }
    Remove-Event $e.EventIdentifier
  }
}

# -------------------------------------------------------------------------
# Entrypoint
# -------------------------------------------------------------------------
if ($Watch) {
  Start-FileWatch
} else {
  Invoke-ImageRelease
}
