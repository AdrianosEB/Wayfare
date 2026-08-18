#!/usr/bin/env bash
# Merge the LoRA adapters into a standalone model for serving (mlx_lm.server can load the
# fused directory directly, no adapter plumbing at inference time).
#
#   ./fuse.sh              # fuse ./adapters/adapters.safetensors — the LAST checkpoint written
#   CKPT=200 ./fuse.sh     # fuse ./adapters/0000200_adapters.safetensors instead
#
# CKPT matters when training ran past the validation minimum: `mlx_lm fuse` takes only a
# directory and always reads `adapters.safetensors` from it, which is whatever was saved most
# recently. Fusing the final weights when the curve bottomed out earlier is silent — the model
# loads and answers fine, it is just the overfit one. Pass CKPT to pin the iteration.
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3

BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}
CKPT=${CKPT:-}
DEQUANTIZE=${DEQUANTIZE:-auto}   # auto | always | never

# `mlx_lm fuse` re-resolves the base model through the Hub and demands a *complete* snapshot —
# including files inference never touches (.gitattributes, README.md). Training and generation
# use a pattern-filtered download, so a cache that trains fine can still fail to fuse with
# IncompleteSnapshotError. Resolve the cached snapshot directory ourselves and hand fuse a
# local path, which skips the Hub entirely.
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
  # Staged in a temp dir so ./adapters is never mutated — the numbered checkpoints stay
  # intact and re-fusing a different iteration costs nothing.
  ADAPTER_PATH=$(mktemp -d)
  trap 'rm -rf "$ADAPTER_PATH"' EXIT
  cp "${ADAPTERS:-./adapters}/adapter_config.json" "$ADAPTER_PATH/"
  cp "$SRC" "$ADAPTER_PATH/adapters.safetensors"
  echo "fuse.sh: fusing iter-$CKPT checkpoint ($SRC)"
fi

# Fusing LoRA into a QUANTIZED base silently produces a model with the adapters not applied:
# no error, no warning — it loads and answers, but as the untuned base. Verified 2026-08-15 on
# the iter-650 checkpoint: base+adapter emitted schema-valid PersonaSchema JSON, the fused model
# emitted degenerate prose, same prompt and tokenizer. `--dequantize` fixes it (fp16 output,
# ~2.9 GB instead of ~1 GB). Always smoke-test what comes out of here — `smoke_test.py` exists
# because this failure is invisible from the fuse output alone.
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
      echo "fuse.sh: base is quantized — fusing with --dequantize (see comment above)"
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
echo "fuse.sh: fused -> ${FUSED:-./fused}. VERIFY IT — a silently-unfused model is indistinguishable"
echo "         from success here:  $PY smoke_test.py --model ${FUSED:-./fused}"
