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

ADAPTER_PATH=./adapters
if [ -n "$CKPT" ]; then
  SRC=$(printf './adapters/%07d_adapters.safetensors' "$CKPT")
  if [ ! -f "$SRC" ]; then
    echo "fuse.sh: no checkpoint for iter $CKPT (looked for $SRC)" >&2
    echo "available:" >&2
    ls ./adapters/[0-9]*_adapters.safetensors >&2 2>/dev/null || echo "  (none)" >&2
    exit 1
  fi
  # Staged in a temp dir so ./adapters is never mutated — the numbered checkpoints stay
  # intact and re-fusing a different iteration costs nothing.
  ADAPTER_PATH=$(mktemp -d)
  trap 'rm -rf "$ADAPTER_PATH"' EXIT
  cp ./adapters/adapter_config.json "$ADAPTER_PATH/"
  cp "$SRC" "$ADAPTER_PATH/adapters.safetensors"
  echo "fuse.sh: fusing iter-$CKPT checkpoint ($SRC)"
fi

"$PY" -m mlx_lm fuse \
  --model "$BASE_MODEL" \
  --adapter-path "$ADAPTER_PATH" \
  --save-path ./fused
