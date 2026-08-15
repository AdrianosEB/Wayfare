#!/usr/bin/env bash
# Merge the LoRA adapters into a standalone model for serving (mlx_lm.server can load the
# fused directory directly, no adapter plumbing at inference time).
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3

BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}

"$PY" -m mlx_lm fuse \
  --model "$BASE_MODEL" \
  --adapter-path ./adapters \
  --save-path ./fused
