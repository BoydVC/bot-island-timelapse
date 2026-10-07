#!/usr/bin/env bash
# Full rebuild: data prep -> headless-Chrome frames -> synthesized soundtrack -> MP4 + GIF -> contact sheet/stills -> checks (~6 min)
set -euo pipefail
cd "$(dirname "$0")"
python3 prep.py
rm -rf frames && node --experimental-websocket --no-warnings render.mjs frames
python3 audio.py
./encode.sh
python3 contact_sheet.py
python3 check.py | tee data/check-output.txt
