#!/usr/bin/env bash
# Merge the LoRA adapters into a standalone model for serving (mlx_lm.server can load the
# fused directory directly).
#
#   ./fuse.sh              # fuse ./adapters/adapters.safetensors, the last checkpoint written
#   CKPT=200 ./fuse.sh     # fuse ./adapters/0000200_adapters.safetensors instead
#
# `mlx_lm fuse` always reads `adapters.safetensors`, which is whatever was saved most recently.
# If training ran past the validation minimum, pass CKPT to pin the iteration.
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3

BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}
CKPT=${CKPT:-}
DEQUANTIZE=${DEQUANTIZE:-auto}   # auto | always | never

# `mlx_lm fuse` re-resolves the base model through the Hub and requires a complete snapshot,
# including files inference never touches (.gitattributes, README.md). Training downloads a
# pattern-filtered subset, so fuse can fail with IncompleteSnapshotError on a cache that trains
# fine. Resolve the cached snapshot directory here and pass fuse a local path instead.
if [ ! -d "$BASE_MODEL" ]; then
  RESOLVED=$("$PY" - "$BASE_MODEL" <<'PY' 2>/dev/null || true
import sys
from huggingface_hub import snapshot_download
print(snapshot_download(sys.argv[1], local_files_only=True,
                        allow_patterns=["*.json", "*.safetensors", "*.txt", "*.jinja"]))
PY
)
  if [ -n "${RESOLVED:-}" ] && [ -d "$RESOLVED" ]; then
    echo "fuse.sh: using cached snapshot $RESOLVED"
    BASE_MODEL="$RESOLVED"
  fi
fi

ADAPTER_PATH=${ADAPTERS:-./adapters}
if [ -n "$CKPT" ]; then
  SRC=$(printf '%s/%07d_adapters.safetensors' "${ADAPTERS:-./adapters}" "$CKPT")
  if [ ! -f "$SRC" ]; then
    echo "fuse.sh: no checkpoint for iter $CKPT (looked for $SRC)" >&2
    echo "available:" >&2
    ls "${ADAPTERS:-./adapters}"/[0-9]*_adapters.safetensors >&2 2>/dev/null || echo "  (none)" >&2
    exit 1
  fi
  # Staged in a temp dir so the numbered checkpoints in ./adapters are left untouched.
  ADAPTER_PATH=$(mktemp -d)
  trap 'rm -rf "$ADAPTER_PATH"' EXIT
  cp "${ADAPTERS:-./adapters}/adapter_config.json" "$ADAPTER_PATH/"
  cp "$SRC" "$ADAPTER_PATH/adapters.safetensors"
  echo "fuse.sh: fusing iter-$CKPT checkpoint ($SRC)"
fi

# Fusing LoRA into a quantized base produces a model without the adapters applied, with no
# error or warning. Seen 2026-08-15 on the iter-650 checkpoint: base+adapter emitted schema-valid
# PersonaSchema JSON, the fused model emitted degenerate prose. `--dequantize` fixes it (fp16
# output, ~2.9 GB instead of ~1 GB). Run `smoke_test.py` on the result.
FUSE_ARGS=()
case "$DEQUANTIZE" in
  always) FUSE_ARGS+=(--dequantize) ;;
  never)  ;;
  auto)
    if "$PY" -c "
import json, sys, pathlib
cfg = pathlib.Path(sys.argv[1]) / 'config.json'
sys.exit(0 if cfg.is_file() and 'quantization' in json.loads(cfg.read_text()) else 1)
" "$BASE_MODEL" 2>/dev/null; then
      echo "fuse.sh: base is quantized, fusing with --dequantize"
      FUSE_ARGS+=(--dequantize)
    fi
    ;;
  *) echo "fuse.sh: DEQUANTIZE must be auto|always|never, got '$DEQUANTIZE'" >&2; exit 1 ;;
esac

"$PY" -m mlx_lm fuse \
  --model "$BASE_MODEL" \
  --adapter-path "$ADAPTER_PATH" \
  --save-path "${FUSED:-./fused}" \
  "${FUSE_ARGS[@]}"

echo
echo "fuse.sh: fused -> ${FUSED:-./fused}. Verify it, since an unfused model looks the same here:"
echo "         $PY smoke_test.py --model ${FUSED:-./fused}"
