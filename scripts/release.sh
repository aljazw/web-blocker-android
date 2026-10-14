#!/usr/bin/env bash
# Ships the current work: checks, commit, push, signed release APK, GitHub release upload.
#
#   bash scripts/release.sh "Commit message"
#
# Stops at the first failure, so a broken build is never pushed or uploaded.
# Without a message it skips the commit and ships what's already committed.
set -euo pipefail

TAG="${RELEASE_TAG:-v1.1.1}"
APK="android/app/build/outputs/apk/release/app-release.apk"

cd "$(dirname "$0")/.."

echo "==> Checks"
npx tsc --noEmit -p .
npx eslint src __tests__ App.tsx --ext .ts,.tsx
npx jest --silent

if [ $# -gt 0 ] && [ -n "$(git status --porcelain)" ]; then
    echo "==> Commit"
    git add -A
    git commit -m "$1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi

echo "==> Build release APK"
(cd android && ./gradlew assembleRelease)

echo "==> Push"
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

echo "==> Upload to GitHub release $TAG"
gh release upload "$TAG" "$APK" --clobber

echo "==> Done: $(ls -lh "$APK" | awk '{print $5}') APK uploaded to $TAG"
