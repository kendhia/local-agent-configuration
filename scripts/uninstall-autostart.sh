#!/usr/bin/env bash
set -euo pipefail

LABEL="${AGENT_CONFIG_DASHBOARD_AUTOSTART_LABEL:-com.kendhia.agent-config-dashboard}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_VALUE="$(id -u)"

launchctl bootout "gui/$UID_VALUE" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"

echo "Removed autostart service: $LABEL"
