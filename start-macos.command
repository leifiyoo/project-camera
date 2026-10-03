#!/usr/bin/env bash
cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit 1
bash ./start.sh "$@"
status=$?
if [ "$status" -ne 0 ]; then
  read -r -p "Startup failed. Press Enter to close this window. "
fi
exit "$status"
