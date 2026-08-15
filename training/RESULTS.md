# Persona distillation — results

> **Status: skeleton.** Populated by `eval.py` in Phase 4. The Measurement Notes below were
> recorded at data-collection time and BIND the reporting — do not average, reframe, or drop
> them when filling in the tables.

## Measurement notes (recorded during the teacher pass, 2026-08-15)

1. **The teacher's own schema-valid rate is 99.5%, not 100%** — 7 of 1,429 attempted rows were
   discarded, all with the same cause: `preferences` returned as stringified JSON (or nested one
   level too deep) instead of a nested object. Student schema-validity must be reported
   **relative to this 99.5% teacher baseline**, not to a perfect 100%. Separately flag whether
   the student reproduces this *specific* failure (stringified/nested `preferences`) at a higher
   rate than the teacher — nested structure being harder to imitate than scalar fields would be
   a real finding about what distillation loses, not noise.

2. **`test-adversarial` had 29/150 rows at recording time** (API credit outage mid-split;
   progress preserved, resumable). At n=29 any percentage carries roughly a ±18pp 95% interval
   and the slice cannot support a conclusion. Rule: **either the split is completed to 150
   before eval, or it is omitted from the results tables entirely with this note as the stated
   reason.** It must never appear beside the 248-row `test` slice formatted as a comparable
   number.

3. **Noise floor for rank agreement:** Opus 4.8 and Sonnet 5 labelled the same 25 profiles at
   0/25 pairs beyond 0.08 normalised MAE and **17/25 top-dimension agreement** — teacher-teacher
   disagreement is the realistic ceiling for any student. Student rank agreement is
   interpretable only against this floor, and it must be cited wherever rank agreement is
   reported.

4. **Provenance caveat:** the `test-adversarial` pool is **model-authored** (see
   `packages/orchestrator-llm/fixtures/persona-signals-adversarial.json`), not a human baseline.
   Every score reported for that slice carries this caveat inline.

## Methods note: training divergence (2026-08-15)

The first completed training run diverged: loss went NaN at iters 101–110 with lr 1e-5 /
batch 4 / bf16 compute (the base checkpoint stores bf16; `mlx_lm lora` exposes no compute-dtype
flag), after a healthy curve to iter 100 (val 3.580 → 2.128 → 1.851) and a peak-memory jump to
14.8 GB of 16 GB. Data was ruled out (995 rows, uniform 2.6–4.7k chars, under the 2048-token
cap). The reported student was trained fresh at lr 5e-6 / batch 2 / `--grad-checkpoint`,
**stable for all 950 iterations run** (no NaN, peak memory 3.78 GB), and stopped by hand once
the curve was judged converged. Reported student = **iter-800 checkpoint**.

Validation curve (every 50 iters, `training/curve.py`; full log in `training/train.log`):

| iter | 1 | 50 | 100 | 150 | 200 | 250 | 300 | 350 | 400 | 450 |
|---|---|---|---|---|---|---|---|---|---|---|
| val | 3.569 | 1.298 | 1.207 | 1.182 | 1.129 | 1.142 | 1.093 | 1.077 | 1.074 | 1.047 |

| iter | 500 | 550 | 600 | 650 | 700 | 750 | **800** | 850 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| val | 1.071 | 1.048 | 1.041 | 1.024 | 1.040 | 1.041 | **0.984** | 1.006 | 0.992 | 0.980 |

The curve is noisy at roughly ±0.03, and flattened three times (iters 250, 400, 700–750) before
descending again — so single flat points are not evidence of convergence here. Iter 950 (0.980)
is nominally 0.004 below the selected iter-800 checkpoint (0.984), a gap well inside that noise;
800 was selected as the converged point, and the 150 fewer iterations are the conservative side
of the memorisation risk the README warns about on a 995-row train split.

**Fusing caveat that affects reproduction:** `mlx_lm fuse` into the 4-bit quantized base
silently produces a model with the adapters *not applied* — no error; it loads and answers as
the untuned base. Verified on the iter-650 checkpoint (base+adapter → schema-valid JSON, fused →
degenerate prose). `fuse.sh` now passes `--dequantize` automatically, and any fused model must be
checked with `smoke_test.py` before it is measured — otherwise Phase 4 risks scoring the
*baseline* under the student's name and reporting distillation as a failure.

## Slices

Reported separately, never averaged: `test` (clean) · `test` (conflict rows) · `test-adversarial`
(if completed — see note 2).

## Three-way comparison

_(populated in Phase 4 by `training/eval.py`)_

| arm | slice | schema-valid (vs 99.5% teacher) | norm. MAE | rank agr. (floor: 17/25 t-t) | raw-sum drift | p50 | p95 | $/1k |
|---|---|---|---|---|---|---|---|---|
| baseline (untuned) | | | | | | | | |
| student (LoRA) | | | | | | | | |
| teacher (Sonnet 5) | | | | | | | | |

## Worst student outputs

_(six worst, each beside the teacher's label for the same input — populated in Phase 4)_
