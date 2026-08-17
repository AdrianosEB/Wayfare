# Persona distillation — training

Distils the `persona` agent (free-text traveler signals → `PersonaSchema` weights/preferences)
from a Claude teacher into a local small model that `mlx_lm.server` can serve. Apple Silicon
only: training is **MLX** — CUDA tooling (Unsloth, bitsandbytes, 4-bit QLoRA) does not apply.

**Base model:** `mlx-community/Qwen2.5-1.5B-Instruct-4bit` (chosen for a 16 GB machine; use the
3B at 24–32 GB, 7B at 36 GB+).

## Reproduce from a clean checkout

```bash
# 0. JS deps (repo root)
pnpm install

# 1. Generate the dataset — teacher labels via the Anthropic API.
#    ~1,550 rows ≈ $8 with claude-sonnet-5. Resumable; re-run to continue after any crash.
#    Splits: train 1000 / valid 150 / test 250 / test-adversarial 150 (see the script header
#    for why the train split is deliberately small, and how to extend it later).
export ANTHROPIC_API_KEY=sk-...
cd packages/orchestrator-llm
pnpm gen:persona-data -- --limit 1000 --model claude-sonnet-5 --max-cost-usd 12
cd ../..
# Output: training/data/{train,valid,test,test-adversarial}.jsonl  (MLX chat format; gitignored)

# 2. Python env
cd training
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt

# 3. Train LoRA adapters (~minutes on an M2 Pro; watch the validation loss)
./train.sh                    # env overrides: ITERS=1200 BASE_MODEL=... ./train.sh

# 4. Merge adapters into a standalone model for serving
./fuse.sh                     # → ./fused   (CKPT=650 ./fuse.sh pins one checkpoint)
./.venv/bin/python smoke_test.py --model ./fused    # ALWAYS verify — see the warning below

# 5. Serve it (OpenAI-compatible endpoint the app's LocalOpenAiModel points at)
./.venv/bin/python -m mlx_lm server --model ./fused --port 8080
```

## ⚠️ Fusing into a quantized base fails silently

`mlx_lm fuse` on a 4-bit base (which `mlx-community/Qwen2.5-1.5B-Instruct-4bit` is) writes a
model with **the adapters not applied** — no error, no warning. The result loads, answers, and
behaves exactly like the untuned base. Verified 2026-08-15: the same checkpoint emitted
schema-valid `PersonaSchema` JSON via base+adapter and degenerate prose via the fused model.

`fuse.sh` now passes `--dequantize` automatically when the base is quantized (fp16 output,
~2.9 GB instead of ~1 GB). Two consequences worth knowing:

- **Always run `verify_fuse.py` against a fused model, then `smoke_test.py`.** `smoke_test.py`
  alone catches only the loud version of this failure, where the unfused model emits prose. Once
  a base is capable enough to emit plausible JSON on its own — which the round-2 prompt showed
  this one is, at 185/250 parseable outputs — "it produced JSON" stops being evidence that
  anything was fused. `verify_fuse.py` checks the weights instead: it dequantizes the base and
  diffs it against the fused model per tensor, using the layers below the LoRA window as a
  roundoff control.

  ```bash
  ./.venv/bin/python verify_fuse.py --fused ./fused-A --adapters ./adapters-A   # weights
  ./.venv/bin/python smoke_test.py  --model ./fused-A                            # behaviour
  ```
- To keep a 4-bit artifact, serve base+adapter instead (`mlx_lm.server --adapter-path ./adapters`)
  or re-quantize the fused model; the fused fp16 directory is the simpler path on a 16 GB machine.

## Tuning `--iters`

800 is a starting point, not a decision. Watch the validation loss `mlx_lm lora` prints every
50 steps (`--steps-per-eval`):

- **plateaus well before the end** → cut iterations to roughly the plateau point and retrain;
  training past the plateau on a 1,000-row set is how the student memorises the teacher's
  phrasing instead of the mapping.
- **still clearly falling at the end** → extend (`ITERS=1200 ./train.sh`), or extend the train
  split first (the generator is resumable — bump the train target in
  `packages/orchestrator-llm/scripts/gen-persona-data.ts` and re-run step 1; it picks up where
  it left off) and retrain.

## What's committed vs not

| committed | gitignored |
|---|---|
| this README, `requirements.txt`, `RESULTS.md`, and every script: `train.sh`, `fuse.sh`, `eval.py`, `eval-round2.sh`, `smoke_test.py`, `verify_fuse.py`, `make_variants.py`, `diagnose_labels.py`, `predictions_to_jsonl.py`, `report.py`, `report_arms.py`, `arm_stats.py`, `curve.py`, `heuristic_labels.mts` | `data*/`, `.venv/`, `adapters*/`, `fused*/`, `results/`, `preds/`, `heuristic-preds/`, `*.log`, all weights |

### What each analysis script is for

| script | question it answers |
|---|---|
| `eval.py` | how does one arm score against the teacher's labels, per row |
| `eval-round2.sh` | runs every model arm over both held-out splits, sequentially |
| `report.py` | round-1 single-student tables |
| `report_arms.py` | the round-2 five-arm comparison, sliced |
| `arm_stats.py` | did an arm beat the constant / majority-class predictors, with CIs — and the paired A-vs-B ablation test |
| `diagnose_labels.py` | is a set of weight vectors actually a function of its input |
| `predictions_to_jsonl.py` | rewrites an arm's predictions so `diagnose_labels.py` can be pointed at **the model's own output**, not just the labels |
| `verify_fuse.py` | are the adapters really in this fused model |
| `make_variants.py` | builds the A/B training targets and measures per-field token share |

The dataset regenerates deterministically from the committed signal pools + seed (modulo the
teacher's own nondeterminism), so the `.jsonl` files are build artifacts, not sources.

## Dataset format

One JSON object per line:

```json
{"messages": [
   {"role": "system",    "content": "<the persona agent's production system prompt>"},
   {"role": "user",      "content": "<signals + trip vibe + budget, as personaNode serialises them>"},
   {"role": "assistant",  "content": "<PersonaSchema JSON from the teacher>"}
 ],
 "meta": {"split": "train", "index": 0, "conflict": false, "signals": ["..."]}}
```

`meta` is ignored by `mlx_lm` (it reads only `messages`) and used by `eval.py` to slice results:
`conflict: true` rows carry a deliberately contradictory signal pair (`dimension` names where),
and the `test-adversarial` split is messy, **model-authored** adversarial phrasing — its scores
are reported separately and carry that provenance caveat wherever they appear.
