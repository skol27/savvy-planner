#!/bin/zsh
cd "$(dirname "$0")"

if [ ! -f "dist/server/index.js" ]; then
  echo "The built app is missing. Build it from Codex or run: bun --bun run build"
  read "?Press return to close."
  exit 1
fi

echo "Starting Savvy Planner..."
echo "Open http://127.0.0.1:4300/ in your browser."
echo "Leave this window open while using the app."
open "http://127.0.0.1:4300/"
node scripts/serve-built.mjs
