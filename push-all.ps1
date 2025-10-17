# ====== CONFIGURATION ======
$USERNAME = "miketud"                # your Docker Hub username
$BACKEND_IMAGE = "realestateapp-backend"
$FRONTEND_IMAGE = "realestateapp-frontend"
$VERSION = "v1.0.0"                    # bump this when you want a new release

# ====== BUILD ======
Write-Host "🧱 Building Docker images..."
docker compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Exiting..."
    exit 1
}

# ====== TAG ======
Write-Host "🏷  Tagging images..."
docker tag "$BACKEND_IMAGE:latest" "$USERNAME/$BACKEND_IMAGE:latest"
docker tag "$BACKEND_IMAGE:latest" "$USERNAME/$BACKEND_IMAGE:$VERSION"
docker tag "$FRONTEND_IMAGE:latest" "$USERNAME/$FRONTEND_IMAGE:latest"
docker tag "$FRONTEND_IMAGE:latest" "$USERNAME/$FRONTEND_IMAGE:$VERSION"

# ====== PUSH ======
Write-Host "🚀 Pushing backend images..."
docker push "$USERNAME/$BACKEND_IMAGE:latest"
docker push "$USERNAME/$BACKEND_IMAGE:$VERSION"

Write-Host "🚀 Pushing frontend images..."
docker push "$USERNAME/$FRONTEND_IMAGE:latest"
docker push "$USERNAME/$FRONTEND_IMAGE:$VERSION"

Write-Host "✅ All done! Both backend and frontend images are now on Docker Hub."
