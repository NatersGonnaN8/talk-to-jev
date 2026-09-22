#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Talk to Jev needs Node.js 20 or newer."
  echo "https://nodejs.org"
  open "https://nodejs.org" 2>/dev/null || true
  read -r -p "Press enter to close"
  exit 1
fi
node scripts/open-app.mjs
status=$?
if [ "$status" -ne 0 ]; then
  read -r -p "Press enter to close"
fi
exit "$status"
