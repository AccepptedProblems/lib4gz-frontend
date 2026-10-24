#!/bin/bash
set -e

echo "========================================="
echo "  Lib4GZ - Deploy DEV Environment"
echo "========================================="

cd "$(dirname "$0")/.."

echo "[1/5] Installing dependencies..."
npm ci

echo "[2/5] Building production bundle..."
npm run build

echo "[3/5] Committing and pushing to production branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "production" ]; then
  echo "  Switching to production branch..."
  git checkout production
  git merge main --no-edit
fi

git add -A
git diff --cached --quiet || git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin production

echo "[4/5] Firebase Hosting auto-deploys from production branch via GitHub Actions."
firebase deploy --only hosting --project w4gz-b4867

echo "[5/5] Done!"
echo "========================================="
echo "  DEV deploy triggered (production branch pushed)"
echo "  Monitor: https://github.com/AccepptedProblems/lib4gz-frontend/actions"
echo "========================================="
