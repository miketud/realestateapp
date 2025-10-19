#!/usr/bin/env bash
set -e

# Colors
GREEN="\033[1;32m"
CYAN="\033[1;36m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo -e "${CYAN}🔍 Detecting modified services...${RESET}"

# Find which directories changed since last build
FRONTEND_CHANGED=false
BACKEND_CHANGED=false

# Check git status or filesystem timestamps
if git diff --quiet --exit-code -- frontend > /dev/null 2>&1; then
  :
else
  FRONTEND_CHANGED=true
fi

if git diff --quiet --exit-code -- backend > /dev/null 2>&1; then
  :
else
  BACKEND_CHANGED=true
fi

# Fallback: if no git repo, detect modified files via mtime (1h threshold)
if [ "$FRONTEND_CHANGED" = false ] && [ "$BACKEND_CHANGED" = false ]; then
  find frontend -type f -mmin -60 | grep . && FRONTEND_CHANGED=true || true
  find backend -type f -mmin -60 | grep . && BACKEND_CHANGED=true || true
fi

# Determine which service(s) to rebuild
if [ "$FRONTEND_CHANGED" = true ] && [ "$BACKEND_CHANGED" = true ]; then
  echo -e "${YELLOW}⚙️  Changes detected in both frontend and backend.${RESET}"
  docker compose build --no-cache frontend backend
elif [ "$FRONTEND_CHANGED" = true ]; then
  echo -e "${YELLOW}⚙️  Changes detected in frontend only.${RESET}"
  docker compose build --no-cache frontend
elif [ "$BACKEND_CHANGED" = true ]; then
  echo -e "${YELLOW}⚙️  Changes detected in backend only.${RESET}"
  docker compose build --no-cache backend
else
  echo -e "${GREEN}✅ No code changes detected — skipping rebuild.${RESET}"
  exit 0
fi

# Restart services
echo -e "${CYAN}🚀 Restarting updated containers...${RESET}"
docker compose up -d
echo -e "${GREEN}✨ Done.${RESET}"
