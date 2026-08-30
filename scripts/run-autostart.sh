#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-}"

if [ -z "$APP_DIR" ]; then
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

cd "$APP_DIR"

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
    return
  fi

  echo "pnpm is not available. Install pnpm or enable corepack, then rerun autostart installation." >&2
  exit 127
}

if [ ! -d "$APP_DIR/.next" ]; then
  run_pnpm install --frozen-lockfile
  run_pnpm build
fi

run_pnpm start
