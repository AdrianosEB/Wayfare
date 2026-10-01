#!/usr/bin/env bash
# Round-2 five-arm eval: generate predictions for every model arm on both held-out splits.
#
#   ./eval-round2.sh            # writes results/{arm}-{split}.json, logs to eval-round2.log
#
# Arms run one at a time. Each loads a ~2.9 GB fp16 model and generates at batch 8, and two at
# once on a 16 GB machine ran out of memory and took down the login session.
#
# The heuristic arm is not here: it needs no model and is scored from `heuristic-preds/` via
# `eval.py --from-jsonl`. The teacher arm is reference-only this round, since a second teacher
# pass needs API credits (RESULTS.md § Five-arm eval).
#
# `--no-require-summary` is for student-B only: `make_variants.py` trains it on labels with
# `summary` stripped, so scoring it against the full PersonaSchema would report 0% valid and
# leave its weight metrics undefined. Validity against the production schema is still recorded
# in the same file.
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3

# A failing arm is recorded and the run continues, so one broken arm does not abort the rest.
FAILED=""
run() {
  echo "=================== $* ==================="
  if ! "$PY" eval.py "$@"; then
    echo "!!! FAILED: $*"
    FAILED="$FAILED\n  $*"
  fi
}

# Latency is sampled on `test` only. It is a property of the model, not of the split.
for arm in student-A student-B baseline; do
  case "$arm" in
    student-A) model=./fused-A; extra=() ;;
    student-B) model=./fused-B; extra=(--no-require-summary) ;;
    baseline)  model=mlx-community/Qwen2.5-1.5B-Instruct-4bit; extra=() ;;
  esac
  # ${a[@]+"${a[@]}"}: expanding an empty array as "${a[@]}" is an unbound-variable error
  # under `set -u` in bash 3.2, which is what /bin/bash is on macOS.
  run --arm "$arm" --model "$model" --split test              --latency-sample 20 ${extra[@]+"${extra[@]}"}
  run --arm "$arm" --model "$model" --split test-adversarial  --latency-sample 0  ${extra[@]+"${extra[@]}"}
done

if [ -n "$FAILED" ]; then
  printf '=================== FAILED ARMS ===================%b\n' "$FAILED"
  exit 1
fi
echo "=================== done ==================="
