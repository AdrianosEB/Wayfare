#!/usr/bin/env bash
#
# Turn a source video into the scroll-scrubbed hero's frame sets.
#
#   scripts/build-hero-frames.sh <source.mp4> [--frames N] [--quality N]
#                                             [--start SS] [--duration SS]
#
# Produces, under apps/web/public/hero/:
#   desktop/frame-0001.webp … + .jpg   ~1920px wide
#   mobile/frame-0001.webp  … + .jpg   ~960px wide
#   poster-desktop.jpg, poster-mobile.jpg
# and writes the real frame count, dimensions, and byte totals to
#   apps/web/src/lib/hero-manifest.json
#
# Everything comes out of one ffmpeg pass: the filter graph decodes the video once, thins it
# to the target frame count, then splits the stream four ways (two scales × two codecs).
# There is no intermediate PNG directory, so re-running to tune --quality against the 8MB
# budget is cheap.

set -euo pipefail

# args & config

SRC=""
TARGET_FRAMES=150   # 120–180 is the useful band: below ~120 the scrub visibly steps,
                    # above ~180 you pay bytes for frames nobody can perceive at scroll speed.
WEBP_QUALITY=72     # libwebp 0–100.
JPEG_Q=4            # mjpeg -q:v, 2–31, lower is better.
START=""
DURATION=""
DESKTOP_WIDTH_OPT=""

die() { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }
note() { printf '\033[36m→\033[0m %s\n' "$1"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --frames)   TARGET_FRAMES="${2:?--frames needs a value}"; shift 2 ;;
    --quality)  WEBP_QUALITY="${2:?--quality needs a value}"; shift 2 ;;
    --jpeg-q)   JPEG_Q="${2:?--jpeg-q needs a value}"; shift 2 ;;
    --width)    DESKTOP_WIDTH_OPT="${2:?--width needs a value}"; shift 2 ;;
    --start)    START="${2:?--start needs a value}"; shift 2 ;;
    --duration) DURATION="${2:?--duration needs a value}"; shift 2 ;;
    -h|--help)  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         die "unknown flag: $1" ;;
    *)          [ -z "$SRC" ] || die "only one source file"; SRC="$1"; shift ;;
  esac
done

[ -n "$SRC" ] || { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
[ -f "$SRC" ] || die "source not found: $SRC"

# 1920 suits graphic or low-detail footage. Detail-dense live action (rippling water
# especially) barely compresses, so to hit the byte budget lower this before --quality,
# which costs artifacts faster than it saves bytes. Measured numbers are in the README.
DESKTOP_WIDTH="${DESKTOP_WIDTH_OPT:-1920}"
MOBILE_WIDTH=960
BUDGET_BYTES=$((8 * 1024 * 1024))

# Resolve paths relative to this script so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$WEB_DIR/public/hero"
MANIFEST="$WEB_DIR/src/lib/hero-manifest.json"

# preflight

command -v ffmpeg  >/dev/null 2>&1 || die "ffmpeg not found. Install it with 'brew install ffmpeg' (macOS) or 'apt install ffmpeg'"
command -v ffprobe >/dev/null 2>&1 || die "ffprobe not found (ships with ffmpeg)"
command -v node    >/dev/null 2>&1 || die "node not found (used to write the manifest)"

ffmpeg -hide_banner -encoders 2>/dev/null | grep -q ' libwebp' \
  || die "this ffmpeg has no libwebp encoder. Reinstall with WebP support ('brew install ffmpeg' includes it)"

# `-fps_mode` replaced `-vsync` in ffmpeg 5. Probe it with a one-frame encode instead of
# grepping `-h full`: ffmpeg 6.0 supports the flag but its help layout hides it from a grep.
if ffmpeg -hide_banner -f lavfi -i nullsrc=s=16x16:d=0.1 \
     -fps_mode passthrough -f null - >/dev/null 2>&1; then
  FPS_MODE=(-fps_mode passthrough)
else
  FPS_MODE=(-vsync 0)
fi

# probe

probe() {
  ffprobe -v error -select_streams v:0 -show_entries "$1" -of default=nw=1:nk=1 "$2" | head -1
}

SRC_W="$(probe stream=width "$SRC")"
SRC_H="$(probe stream=height "$SRC")"
SRC_DUR="$(probe format=duration "$SRC" 2>/dev/null || true)"
[ -n "$SRC_DUR" ] || SRC_DUR="$(probe stream=duration "$SRC")"

# The window we actually sample.
CLIP_DUR="${DURATION:-$SRC_DUR}"
awk "BEGIN{exit !($CLIP_DUR > 0)}" || die "could not determine a positive duration for $SRC"

# Frames are thinned with the fps filter: fps = target_frames / clip_seconds.
#   select='not(mod(n\,K))'
# would pick every Kth source frame with no temporal resampling, but it is only correct when
# the ratio is a whole number, and the difference is invisible on a scrub.
FPS="$(awk "BEGIN{printf \"%.6f\", $TARGET_FRAMES / $CLIP_DUR}")"

note "source: ${SRC_W}x${SRC_H}, ${SRC_DUR}s"
note "sampling ${TARGET_FRAMES} frames over ${CLIP_DUR}s → fps=${FPS}"

# extract

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/desktop" "$OUT_DIR/mobile"

# Both trim flags must sit before -i, as input options. After -i, `-t` becomes an output
# option that binds only to the next output file, so with four `-map`ed outputs it would
# trim the first and let the other three run to the end of the source. The frame-count
# guard below catches that.
SEEK=()
[ -n "$START" ] && SEEK+=(-ss "$START")
[ -n "$DURATION" ] && SEEK+=(-t "$DURATION")

# min(TARGET,iw) never upscales. -2 keeps the aspect ratio and rounds to an even number of
# pixels.
FILTER="fps=${FPS},split=2[hi][lo];\
[hi]scale=w='min(${DESKTOP_WIDTH}\,iw)':h=-2:flags=lanczos,split=2[dw][dj];\
[lo]scale=w='min(${MOBILE_WIDTH}\,iw)':h=-2:flags=lanczos,split=2[mw][mj]"

note "extracting (one decode, four outputs)…"
ffmpeg -hide_banner -loglevel warning -y \
  "${SEEK[@]}" -i "$SRC" \
  -filter_complex "$FILTER" \
  -map '[dw]' "${FPS_MODE[@]}" -c:v libwebp -quality "$WEBP_QUALITY" -compression_level 6 -preset photo "$OUT_DIR/desktop/frame-%04d.webp" \
  -map '[dj]' "${FPS_MODE[@]}" -c:v mjpeg   -q:v "$JPEG_Q"                                  "$OUT_DIR/desktop/frame-%04d.jpg" \
  -map '[mw]' "${FPS_MODE[@]}" -c:v libwebp -quality "$WEBP_QUALITY" -compression_level 6 -preset photo "$OUT_DIR/mobile/frame-%04d.webp" \
  -map '[mj]' "${FPS_MODE[@]}" -c:v mjpeg   -q:v "$JPEG_Q"                                  "$OUT_DIR/mobile/frame-%04d.jpg"

# Posters come straight from the source, not re-encoded from a lossy frame: every visitor
# sees this image, including those who never get the sequence.
note "rendering posters…"
for pair in "desktop:$DESKTOP_WIDTH" "mobile:$MOBILE_WIDTH"; do
  variant="${pair%%:*}"; width="${pair##*:}"
  # `-update 1` is required: the image2 muxer refuses a filename with no %d pattern
  # without it.
  ffmpeg -hide_banner -loglevel warning -y \
    "${SEEK[@]}" -i "$SRC" -frames:v 1 -update 1 \
    -vf "scale=w='min(${width}\,iw)':h=-2:flags=lanczos" \
    -q:v 3 "$OUT_DIR/poster-${variant}.jpg"
done

# measure

count_files() { find "$1" -name "*.$2" -type f | wc -l | tr -d ' '; }
# `cat | wc -c` instead of stat: stat's size flag differs between BSD and GNU, and this
# script runs on a Mac and in CI.
byte_total() { find "$1" -name "*.$2" -type f -exec cat {} + | wc -c | tr -d ' '; }
# Pass values with `awk -v`, not interpolated into the program text. Nested escaped quotes
# inside a command substitution broke the percentage calculation below.
human() { awk -v b="$1" 'BEGIN{ printf "%.2f MB", b/1048576 }'; }
pct() { awk -v b="$1" -v t="$2" 'BEGIN{ printf "%.0f", 100*b/t }'; }

FRAME_COUNT="$(count_files "$OUT_DIR/desktop" webp)"
[ "$FRAME_COUNT" -gt 0 ] || die "ffmpeg produced no frames"

MOBILE_COUNT="$(count_files "$OUT_DIR/mobile" webp)"
[ "$FRAME_COUNT" = "$MOBILE_COUNT" ] \
  || die "frame counts diverged (desktop $FRAME_COUNT, mobile $MOBILE_COUNT); the manifest assumes they match"

DESKTOP_WEBP_BYTES="$(byte_total "$OUT_DIR/desktop" webp)"
DESKTOP_JPEG_BYTES="$(byte_total "$OUT_DIR/desktop" jpg)"
MOBILE_WEBP_BYTES="$(byte_total "$OUT_DIR/mobile" webp)"
MOBILE_JPEG_BYTES="$(byte_total "$OUT_DIR/mobile" jpg)"

DESKTOP_W="$(probe stream=width  "$OUT_DIR/desktop/frame-0001.webp")"
DESKTOP_H="$(probe stream=height "$OUT_DIR/desktop/frame-0001.webp")"
MOBILE_W="$(probe stream=width  "$OUT_DIR/mobile/frame-0001.webp")"
MOBILE_H="$(probe stream=height "$OUT_DIR/mobile/frame-0001.webp")"

# manifest

node -e '
const [out, frames, dw, dh, db, mw, mh, mb, dur, fps] = process.argv.slice(1);
const manifest = {
  // Cache-busting stamp. Frames live at stable paths under public/, so without it returning
  // visitors keep cached frames after a re-run, possibly mixed with new ones.
  version: Date.now().toString(36),
  frames: Number(frames),
  pad: 4,
  start: 1,
  formats: ["webp", "jpg"],
  basename: "frame",
  variants: {
    desktop: { dir: "/hero/desktop", width: Number(dw), height: Number(dh), bytes: Number(db) },
    mobile:  { dir: "/hero/mobile",  width: Number(mw), height: Number(mh), bytes: Number(mb) },
  },
  poster: { desktop: "/hero/poster-desktop.jpg", mobile: "/hero/poster-mobile.jpg" },
  source: { duration: Number(Number(dur).toFixed(3)), fps: Number(Number(fps).toFixed(3)) },
};
require("fs").writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST" "$FRAME_COUNT" "$DESKTOP_W" "$DESKTOP_H" "$DESKTOP_WEBP_BYTES" \
  "$MOBILE_W" "$MOBILE_H" "$MOBILE_WEBP_BYTES" "$CLIP_DUR" "$FPS"

# report

printf '\n\033[1mframes\033[0m  %s\n' "$FRAME_COUNT"
printf '\033[1mdesktop\033[0m %sx%s   webp %s   (jpg fallback %s)\n' \
  "$DESKTOP_W" "$DESKTOP_H" "$(human "$DESKTOP_WEBP_BYTES")" "$(human "$DESKTOP_JPEG_BYTES")"
printf '\033[1mmobile\033[0m  %sx%s    webp %s   (jpg fallback %s)\n' \
  "$MOBILE_W" "$MOBILE_H" "$(human "$MOBILE_WEBP_BYTES")" "$(human "$MOBILE_JPEG_BYTES")"
printf '\033[1mmanifest\033[0m %s\n\n' "${MANIFEST#"$WEB_DIR/"}"

# The budget applies to the WebP set, which is what a visitor downloads. The JPEGs are only
# for engines without WebP.
if [ "$DESKTOP_WEBP_BYTES" -gt "$BUDGET_BYTES" ]; then
  OVER_MB="$(human $((DESKTOP_WEBP_BYTES - BUDGET_BYTES)))"
  printf '\033[31m✗ over the 8MB desktop budget by %s\033[0m\n' "$OVER_MB"
  printf '  retry lower, in this order of preference:\n'
  printf '    --width %s         (smaller frames: best bytes-per-quality on detailed footage)\n' \
    $((DESKTOP_WIDTH > 1440 ? 1440 : DESKTOP_WIDTH - 160))
  printf '    --frames %s        (fewer frames: linear saving, scrub stays smooth to ~120)\n' \
    $((FRAME_COUNT > 130 ? FRAME_COUNT - 30 : 120))
  printf '    --quality %s       (last resort: on noisy footage this costs quality faster than bytes)\n' \
    $((WEBP_QUALITY > 60 ? WEBP_QUALITY - 12 : 50))
  exit 1
fi

USED_PCT="$(pct "$DESKTOP_WEBP_BYTES" "$BUDGET_BYTES")"
USED_MB="$(human "$DESKTOP_WEBP_BYTES")"
printf '\033[32m✓ within the 8MB desktop budget (%s of 8.00 MB, %s%% used)\033[0m\n' \
  "$USED_MB" "$USED_PCT"
