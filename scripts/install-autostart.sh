#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${AGENT_CONFIG_DASHBOARD_AUTOSTART_LABEL:-com.kendhia.agent-config-dashboard}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/agent-config-dashboard"
UID_VALUE="$(id -u)"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  value="${value//\"/&quot;}"
  printf '%s' "$value"
}

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
    return
  fi

  echo "pnpm is not available. Install pnpm or enable corepack, then rerun this script." >&2
  exit 127
}

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cd "$APP_DIR"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  run_pnpm install --frozen-lockfile
  run_pnpm build
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$(xml_escape "$LABEL")</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(xml_escape "$APP_DIR/scripts/run-autostart.sh")</string>
    <string>$(xml_escape "$APP_DIR")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$APP_DIR")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$(xml_escape "$LOG_DIR/out.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "$LOG_DIR/error.log")</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null

launchctl bootout "gui/$UID_VALUE" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_VALUE" "$PLIST"
launchctl enable "gui/$UID_VALUE/$LABEL"
launchctl kickstart -k "gui/$UID_VALUE/$LABEL"

echo "Installed autostart service: $LABEL"
echo "App URL: http://localhost:4321"
echo "Logs: $LOG_DIR"
