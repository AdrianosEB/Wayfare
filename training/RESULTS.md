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
