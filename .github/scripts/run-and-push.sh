#!/usr/bin/env bash
set -u
mode="$1"
git config user.name "Plugin Repo Bot"
git config user.email "github-actions[bot]@users.noreply.github.com"
for attempt in 1 2 3 4 5; do
  dotnet out/RepoMerger.dll "$mode"
  code=$?
  if [ "$code" -ne 0 ] && [ "$code" -ne 1 ]; then exit "$code"; fi
  git add -A
  if git diff --staged --quiet; then exit "$code"; fi
  git commit -q -F commit-message.txt
  if git push -q; then exit "$code"; fi
  echo "Push rejected (attempt $attempt), syncing and retrying"
  git fetch -q origin main
  git reset -q --hard origin/main
done
echo "Could not push after 5 attempts" >&2
exit 1
