#!/usr/bin/env bash
set -euo pipefail

LABEL="${AGENT_CONFIG_DASHBOARD_AUTOSTART_LABEL:-com.kendhia.agent-config-dashboard}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_VALUE="$(id -u)"

if [ ! -f "$PLIST" ]; then
  echo "Autostart service is not installed: $LABEL"
  exit 1
fi

if launchctl print "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1; then
  echo "Autostart service is loaded: $LABEL"
  launchctl print "gui/$UID_VALUE/$LABEL" | sed -n '/state = /p;/last exit code = /p;/pid = /p'
else
  echo "Autostart service exists but is not loaded: $PLIST"
  exit 1
fi
