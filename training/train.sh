#!/usr/bin/env bash
# LoRA-tune the persona student on the teacher dataset. Run from training/ with the venv active
# (or let the script find ./.venv). Produces ./adapters (LoRA weights) — fuse.sh merges them.
#
# Flags, and why each value:
#   --data (DATA, ./data)    expects train.jsonl + valid.jsonl in MLX chat format;
#                            DATA=./data-B ADAPTERS=./adapters-B ./train.sh for the ablation
#   --iters (ITERS, 1500)    tune against the validation curve, not by faith — see README;
#                            raised from 800 for the halved LR, stop early where it flattens
#   --learning-rate 5e-6     halved from the 1e-5 default after loss diverged to NaN at iter
#                            101-110 (2026-08-15 run; see RESULTS.md methods note)
#   --batch-size 2           batch 4 peaked at 14.8GB of 16GB unified memory — no headroom
#                            with macOS competing; 2 + grad-checkpoint buys margin
#   --grad-checkpoint        trades recompute for memory, same motivation as batch 2
#   --num-layers 16          LoRA on the top 16 transformer layers
#   --steps-per-eval 50      validation-loss cadence; this is the curve HUMAN GATE 2 reviews
#   --save-every 50          checkpoint adapters every 50 iters — a crash costs ≤50 iters
#   --seed 20260814          matches the dataset generator's seed for reproducibility
#
# Resuming after a crash: set RESUME to a checkpoint and ITERS to the REMAINING count, and
# point ADAPTERS at a fresh directory so the pre-crash checkpoints are not renumbered over:
#   DATA=./data-B ADAPTERS=./adapters-B-cont ITERS=750 \
#     RESUME=./adapters-B/0000250_adapters.safetensors ./train.sh
# mlx-lm restores adapter weights but not optimizer or data-loader state, so the resumed run
# replays the same shuffle from batch 0 — note it wherever the curve is reported.
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3   # fall back to system python if no venv here

# The 16GB-unified-memory pick for this Mac (see _distillation-run/RUNBOOK.md).
BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}

"$PY" -m mlx_lm lora \
  --model "$BASE_MODEL" \
  --train \
  --data "${DATA:-./data}" \
  --iters "${ITERS:-1500}" \
  --learning-rate 5e-6 \
  --batch-size 2 \
  --grad-checkpoint \
  --num-layers 16 \
  --steps-per-eval 50 \
  --save-every 50 \
  --adapter-path "${ADAPTERS:-./adapters}" \
  --seed 20260814 \
  ${RESUME:+--resume-adapter-file "$RESUME"}
