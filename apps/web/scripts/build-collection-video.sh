#!/usr/bin/env bash
#
# build-collection-video.sh — cut the /collection page's looping clips from a source video.
#
#   scripts/build-collection-video.sh <source.mp4>
#
# Emits, per loop, into public/collection/:
#   <name>.mp4    H.264 high/4.0, yuv420p, NO audio track, faststart, under 2.5MB
#   <name>.webp   the loop's FIRST FRAME, used as its poster
#
# The poster is extracted from the already-trimmed loop rather than re-seeking the source,
# so it is genuinely frame one and the swap from poster to video is invisible.
set -euo pipefail

SRC="${1:?usage: build-collection-video.sh <source.mp4>}"
[ -f "$SRC" ] || { echo "source not found: $SRC" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
OUT="$WEB_DIR/public/collection"
MAX_BYTES=$((2500 * 1024))

mkdir -p "$OUT"

# name:start:duration:width:crf — distinct windows, so these are different shots rather
# than one clip reused. The hero loop is deliberately the smallest: it is the only video
# that loads inside the first chapter, which carries a hard 1.2MB interactive budget.
LOOPS="harbour-pan:12:5:1280:28 harbour-open:4.5:5:1600:26"

for spec in $LOOPS; do
  IFS=: read -r name start dur WIDTH CRF <<< "$spec"

  ffmpeg -hide_banner -loglevel error -y \
    -ss "$start" -t "$dur" -i "$SRC" \
    -vf "scale=w=${WIDTH}:h=-2:flags=lanczos" \
    -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p \
    -crf "$CRF" -preset slow -g 60 -movflags +faststart \
    -an \
    "$OUT/${name}.mp4"

  # Poster = frame one of the encoded loop.
  ffmpeg -hide_banner -loglevel error -y \
    -i "$OUT/${name}.mp4" -frames:v 1 -update 1 \
    -c:v libwebp -quality 78 -compression_level 6 -preset photo \
    "$OUT/${name}.webp"

  bytes=$(wc -c < "$OUT/${name}.mp4" | tr -d ' ')
  poster=$(wc -c < "$OUT/${name}.webp" | tr -d ' ')
  audio=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$OUT/${name}.mp4" | wc -l | tr -d ' ')
  status=$([ "$bytes" -le "$MAX_BYTES" ] && echo "OK" || echo "OVER 2.5MB")
  awk -v n="$name" -v b="$bytes" -v p="$poster" -v a="$audio" -v s="$status" \
    'BEGIN{ printf "%-14s mp4 %6.2f MB   poster %5.0f KB   audio streams: %s   %s\n", n, b/1048576, p/1024, a, s }'
done
