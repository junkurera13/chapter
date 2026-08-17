#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap: refresh dependencies and generated types.
set -euo pipefail

cd "$(dirname "$0")/.."

# Select the Node 24 toolchain this project pins (see scripts/cloud-node.sh).
# shellcheck disable=SC1091
source scripts/cloud-node.sh

node -v

# Install dependencies. The repository documents `npm install` (README), and
# the committed lockfile is not fully in sync with package.json, so `npm ci`
# is not usable here. `npm install` converges and is safe to run repeatedly.
npm install

# Next generates next-env.d.ts and .next/types; without them `tsc --noEmit`
# reports spurious errors on image and route imports. typegen is cheap and
# does not require any runtime secrets.
npx next typegen
