#!/usr/bin/env bash
# Round-2 five-arm eval: generate predictions for every model arm on both held-out splits.
#
#   ./eval-round2.sh            # writes results/{arm}-{split}.json, logs to eval-round2.log
#
# Runs strictly SEQUENTIALLY. Each arm loads a ~2.9 GB fp16 model and generates at batch 8; two
# at once on a 16 GB machine is how this project lost a whole login session during training — a
# jetsam event at ~134 MB free, then WindowServer killed by its watchdog, which tears down the
# terminal and every child process with it. The wall-clock saving is not worth it.
#
# The heuristic arm is not here: it needs no model and is scored from `heuristic-preds/` via
# `eval.py --from-jsonl`. The teacher arm is reference-only this round — a genuine second
# teacher pass needs API credits, which are not available (RESULTS.md § Five-arm eval).
#
# `--no-require-summary` for student-B only: `make_variants.py` trains it on labels with
# `summary` stripped, so scoring it against the full PersonaSchema would report 0% valid and
# leave its weight metrics undefined — the ablation would be unmeasurable rather than negative.
# Validity against the production schema is recorded separately in the same file regardless.
set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-./.venv/bin/python}
[ -x "$PY" ] || PY=python3

# A failing arm is recorded and the run continues. Under plain `set -e` the first crash aborts
# every later arm too — which is how a `validate_persona` TypeError on the baseline's malformed
# output cost the two baseline splits after four arms had already succeeded. One broken arm
# should cost one arm.
FAILED=""
run() {
  echo "=================== $* ==================="
  if ! "$PY" eval.py "$@"; then
    echo "!!! FAILED: $*"
    FAILED="$FAILED\n  $*"
  fi
}

# Latency is sampled on `test` only. It is a per-request property of the model, not of the
# split, so paying for a second sequential sample on test-adversarial buys nothing.
for arm in student-A student-B baseline; do
  case "$arm" in
    student-A) model=./fused-A; extra=() ;;
    student-B) model=./fused-B; extra=(--no-require-summary) ;;
    baseline)  model=mlx-community/Qwen2.5-1.5B-Instruct-4bit; extra=() ;;
  esac
  # ${a[@]+"${a[@]}"} — expanding an EMPTY array as "${a[@]}" is an unbound-variable error
  # under `set -u` in bash 3.2, which is what /bin/bash is on macOS. Every arm but student-B
  # has no extra flags, so the plain form aborts the script before the first run.
  run --arm "$arm" --model "$model" --split test              --latency-sample 20 ${extra[@]+"${extra[@]}"}
  run --arm "$arm" --model "$model" --split test-adversarial  --latency-sample 0  ${extra[@]+"${extra[@]}"}
done

if [ -n "$FAILED" ]; then
  printf '=================== FAILED ARMS ===================%b\n' "$FAILED"
  exit 1
fi
echo "=================== done ==================="
