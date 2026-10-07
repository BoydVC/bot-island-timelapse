#!/usr/bin/env bash
# Encode frames/ + data/soundtrack.wav -> out/bot-island-timelapse.mp4 (1280x720, H.264 + AAC) and out/bot-island-timelapse.gif
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
# two-pass at 1.6 Mb/s video + 128 kb/s audio keeps the ~80 s film well under 20 MB
P=$(mktemp -d)
ffmpeg -y -loglevel error -framerate 24 -i frames/f%05d.jpg -c:v libx264 -preset slow -tune animation -b:v 1600k -pix_fmt yuv420p -pass 1 -passlogfile "$P/x264" -an -f mp4 /dev/null
ffmpeg -y -loglevel error -framerate 24 -i frames/f%05d.jpg -i data/soundtrack.wav \
  -c:v libx264 -preset slow -tune animation -b:v 1600k -maxrate 3M -bufsize 6M -pix_fmt yuv420p -pass 2 -passlogfile "$P/x264" \
  -c:a aac -b:a 128k -shortest -movflags +faststart out/bot-island-timelapse.mp4
rm -rf "$P"
# GIF preview: the whole film at 2x speed, 480x270, 10 fps, 96-colour palette (~40 s)
ffmpeg -y -loglevel error -framerate 24 -i frames/f%05d.jpg \
  -vf "setpts=0.5*PTS,fps=10,scale=480:270:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  out/bot-island-timelapse.gif
ls -la out/
