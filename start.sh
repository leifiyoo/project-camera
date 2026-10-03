#!/usr/bin/env bash
set -e
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 24 LTS (including npm) from https://nodejs.org/en/download and try again."
  exit 1
fi

echo "Preparing Interface Studio..."
npm ci
echo "Open the Local URL shown below in your browser. Stop the studio with Ctrl+C."
npm run dev -- "$@"
