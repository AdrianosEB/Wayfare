#!/usr/bin/env bash
# LoRA-tune the persona student on the teacher dataset. Run from training/ with the venv active
# (or let the script find ./.venv). Produces ./adapters (LoRA weights) — fuse.sh merges them.
#
# Flags, and why each value:
#   --data ./data            expects train.jsonl + valid.jsonl in MLX chat format
#   --iters (ITERS, 800)     tune against the validation curve, not by faith — see README
#   --batch-size 4           16GB unified memory: 4 fits; raise only if memory allows
#   --num-layers 16          LoRA on the top 16 transformer layers
#   --steps-per-eval 50      validation-loss cadence; this is the curve HUMAN GATE 2 reviews
#   --seed 20260814          matches the dataset generator's seed for reproducibility
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3   # fall back to system python if no venv here

# The 16GB-unified-memory pick for this Mac (see _distillation-run/RUNBOOK.md).
BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}

"$PY" -m mlx_lm lora \
  --model "$BASE_MODEL" \
  --train \
  --data ./data \
  --iters "${ITERS:-800}" \
  --batch-size 4 \
  --num-layers 16 \
  --steps-per-eval 50 \
  --adapter-path ./adapters \
  --seed 20260814
