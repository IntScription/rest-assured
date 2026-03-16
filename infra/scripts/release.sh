#!/usr/bin/env bash

set -euo pipefail

IMAGE="ghcr.io/intscription/gravity-log-web:latest"
MAX_ATTEMPTS=30
SLEEP_SECONDS=10

echo "🚀 Starting release..."

# Ensure we're at repo root-ish by checking for .git
if [ ! -d ".git" ]; then
  echo "❌ Run this script from the repository root."
  exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ You have uncommitted changes. Commit or stash them first."
  exit 1
fi

echo "📤 Pushing current branch..."
git push

echo "⏳ Waiting for GHCR image to be available: $IMAGE"
attempt=1
until docker manifest inspect "$IMAGE" >/dev/null 2>&1; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "❌ Timed out waiting for image to appear in GHCR."
    echo "Check your GitHub Actions workflow status."
    exit 1
  fi

  echo "   Attempt $attempt/$MAX_ATTEMPTS... image not ready yet"
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

echo "✅ Image is available in GHCR"

echo "🚢 Deploying to Kubernetes..."
./infra/scripts/deploy.sh

echo "🎉 Release complete"
