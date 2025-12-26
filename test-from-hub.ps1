# ---------- run by: powershell -ExecutionPolicy Bypass -File .\test-from-hub.ps1 -Prune
param(
  [string] $ComposeFile = "docker-compose.test.yml",
  [switch] $Prune        # optional: remove all old images before pull
)

$ErrorActionPreference = "Stop"

# 1. Confirm Docker is running
Write-Host "[CHECK] Ensuring Docker is available..."
docker version | Out-Null

# 2. Optionally prune old images
if ($Prune) {
  Write-Host "[CLEANUP] Pruning old images and cache..."
  docker system prune -a -f | Out-Host
}

# 3. Stop any previous containers
Write-Host "[STOP] Bringing down any running containers..."
docker compose -f $ComposeFile down --remove-orphans | Out-Host

# 4. Pull fresh images from Docker Hub
Write-Host "[PULL] Fetching latest images from Docker Hub..."
docker compose -f $ComposeFile pull | Out-Host

# 5. Start stack using the tester compose file
Write-Host "[UP] Starting containers..."
docker compose -f $ComposeFile up -d | Out-Host

# 6. Show container status
Write-Host "`n[STATUS] Running containers:"
docker compose -f $ComposeFile ps

# 7. Optional: auto-open frontend in browser
$frontendUrl = "http://localhost:5173"
try {
  Write-Host "`n[OPEN] Launching $frontendUrl ..."
  Start-Process $frontendUrl
} catch {
  Write-Host "[INFO] Could not auto-open browser. Open manually: $frontendUrl"
}
