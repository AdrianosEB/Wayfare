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

Reported separately, never averaged: `test` (clean, 169 rows) · `test` (conflict, 79 rows).

**`test-adversarial` is omitted from every table below.** It stood at 29/150 rows when the
API credits ran out and could not be completed (no `ANTHROPIC_API_KEY` reachable at eval time).
Measurement note 2 permits exactly two options — complete it to 150, or omit it with this as
the stated reason — and never allows n=29 beside the 248-row `test` slice as a comparable
number. This is the second option, taken because the first was unavailable.

## Headline: the student learned the format, not the mapping

**The distillation failed at the task, while succeeding at everything easy to measure.** The
student emits well-formed `PersonaSchema` JSON at close to the teacher's own rate, and its
`summary` prose is fluent and on-topic. Its *weights* — the only part the ranker consumes —
carry no information about the input.

Four independent lines of evidence, all on the 243 schema-valid rows of `test`:

1. **Top-dimension agreement equals the majority-class prior exactly.** The student answers
   `price` on 242 of 243 rows. It scores 175/243 = **72.0%** agreement; a predictor that
   ignores the input and always answers `price` scores **175/243 = 72.0%** — the same rows,
   not merely the same rate.
2. **It is beaten by a constant.** Predicting the teacher's *mean* weight vector for every
   row gives normalised MAE **0.0565**; the student gets **0.0587**. The student is slightly
   worse than answering the same thing every time.
3. **Its output is independent of the target.** Where the teacher chose `quality` (n=46) the
   student said `price` 46/46; `vibe` (n=6) → `price` 6/6; `flexibility` (n=4) → `price` 4/4;
   `location` (n=12) → `price` 11/12.
4. **The output space collapsed.** 243 student outputs contain **24 distinct weight vectors**,
   one of which covers 93 rows (38%); the teacher's 248 labels contain **157 distinct** vectors.

Because of (1), **the 74.1% top-dimension agreement on the clean slice must not be read against
the 17/25 (68%) teacher-teacher floor as if clearing it meant something.** It clears the floor
the way a broken clock clears it. Rank agreement is uninterpretable for this student; the
constant-predictor comparison in (2) replaces it as the meaningful reference.

### Why the validation curve missed this

The `summary` field is a median **80.9%** of the assistant label by characters; `weights` is
**4.7%**. Token-level cross-entropy is therefore dominated roughly 17:1 by prose, and the model
minimised it the cheap way — learning to write like a travel consultant, while leaving the
weights at their marginal distribution. The validation curve (3.569 → 0.984, monotone in the
large) was measuring mostly prose fidelity. **A healthy loss curve was never evidence the
mapping was being learned, and HUMAN GATE 2 could not have caught this** — only a task metric
on held-out inputs could, which is what Phase 4 is for.

## Student vs teacher — `test` split

Reference is the teacher's stored label for the same input. Teacher schema-valid rate
**99.5%**; teacher-teacher top-dimension ceiling **17/25 (68%)**; teacher-teacher MAE envelope
**0/25 pairs beyond 0.08**.

| slice | n | schema-valid (teacher 99.5%) | norm. MAE | MAE p95 | rows beyond 0.08 MAE (t-t: 0/25) | top-dim agr. (= prior, see above) | pace agr. | raw-sum drift |
|---|---|---|---|---|---|---|---|---|
| clean | 169 | 98.2% (166/169) | 0.0578 | 0.1105 | 31/166 (18.7%) | 74.1% | 66.9% | 0.0349 |
| conflict | 79 | 97.5% (77/79) | 0.0606 | 0.1200 | 14/77 (18.2%) | 67.5% | 74.0% | 0.0364 |

Reference points on the same axis: constant predictor (teacher mean) MAE **0.0565**; student
modal vector MAE **0.0608**; student actual **0.0587**.

Latency, student, sequential sample n=20: p50 **13.66 s**, p95 **16.09 s** (fp16 fused model,
local, no API spend). Teacher: $7.28 / 1,429 rows = **$5.09 per 1k**.

### Schema validity — the student did *not* inherit the teacher's failure

5 of 248 rows failed. **None reproduced the teacher's stringified/over-nested `preferences`
failure — 0/248.** Measurement note 1 asked whether the student inherits that specific defect
at a higher rate than the teacher's 0.49%; it does not inherit it at all, so nested structure
survived distillation intact. That is a real, if narrow, positive finding.

The 5 failures are unrelated modes:

| mode | n | detail |
|---|---|---|
| repetition loop → truncation | 2 | degenerates mid-`summary` ("overland overland …") until the 1200-token cap; string never closes |
| unescaped `"` inside `summary` | 1 | wrote `preferredTimes=["any"]` as literal prose inside the string |
| stray trailing characters | 2 | otherwise-complete JSON followed by `""}` or `"}"}`  |

One of the trailing-character rows (index 129) is valid JSON *followed by* garbage and would be
recoverable by a balanced-brace reader; under such a reader validity is 244/248 (98.4%). The
98.0% figure is the strict bare-JSON rate, which is what the production path requires.

## Worst student outputs

Regenerate with `./.venv/bin/python report.py --worst 6`. Ranked schema-invalid first, then by
normalised MAE descending. The five invalid rows are listed above by failure mode; the worst
*scored* row is the one that shows the collapse most clearly:

**row 128 · conflict · MAE 0.1495 · student top `price` vs teacher top `quality`**

- signals: `has saved for this and wants to feel it` · `wants the shortest total journey time` ·
  `would rather bring back nothing` · `waves off the bill talk, it's a holiday`
- student: `price 0.40` quality 0.15 location 0.15 vibe 0.20 flexibility 0.15
- teacher: `price 0.05` quality 0.35 location 0.20 vibe 0.30 flexibility 0.10

Two of the four signals say plainly that this traveller is *not* price-led ("waves off the bill
talk", "has saved for this and wants to feel it"). The teacher read them and put price **last**
at 0.05. The student put price **first** at 0.40 — the exact inversion, and an unusually direct
demonstration that the weights do not depend on the input. This row is the one to re-check
first after any retraining: if price is still top here, nothing has changed.

The six worst *scored* rows, for completeness — every one of them a case where the student said
`price` and the teacher did not:

| row | slice | norm. MAE | student top | teacher top |
|---|---|---|---|---|
| 128 | conflict | 0.1495 | price | quality |
| 51 | clean | 0.1400 | price | quality |
| 166 | conflict | 0.1305 | price | quality |
| 141 | clean | 0.1295 | price | quality |
| 3 | clean | 0.1267 | price | quality |
| 177 | clean | 0.1267 | price | vibe |

Full outputs and teacher labels for every row are in `results/student-test.json`.

## Untuned baseline — context only, not the comparison

0/248 schema-valid. Exactly zero: the untuned base answers the persona prompt with prose,
markdown headers, and invented scoring dimensions, and there is no `{...}` anywhere in its
output to extract. Its normalised MAE is **undefined**, not poor — there is nothing to score.

This arm is reported here and never in the student's table. Against a floor of zero, any
schema-valid rate looks like a triumph, and the meaningful comparison is student vs teacher.

## Root cause: the labels, not the student

The student was a faithful distillation of a degenerate teacher. `training/diagnose_labels.py`
joins each row's signals back to the `d` dimension tags in
`packages/orchestrator-llm/fixtures/persona-signals.json` and cross-tabulates the dominant input
dimension against the teacher's argmax weight. On the original train split the diagonal is flat:

| input \ label | price | quality | location | vibe | flexibility | n |
|---|---|---|---|---|---|---|
| price | **67%** | 24% | 5% | 2% | 1% | 82 |
| quality | 83% | **12%** | 3% | 1% | 1% | 177 |
| location | 85% | 5% | **7%** | 4% | 0% | 105 |
| vibe | 82% | 13% | 3% | **2%** | 0% | 194 |
| flexibility | 87% | 9% | 2% | 0% | **1%** | 135 |

81.2% of labels are price-top; entropy is 0.936 of a possible 2.322 bits. The bias is not
inherited from the inputs — price is only 41 of 356 train signals (11.5%).

**The "noise floor" was chance agreement.** Sum of squares of that marginal is **0.678**; the
recorded teacher-teacher agreement was 17/25 = **0.680**. Two labellers drawing independently
from this prior would have agreed at exactly the observed rate, so measurement note 3's floor
measures the shared prior, not labeller noise. It cannot bound student quality, and every
citation of it in this document must be read with that correction.

### The defect is the default, not input-insensitivity

The teacher separates price correctly when told, and fails only in the absence of evidence:

| price signal | n (train) | mean price weight | price-top |
|---|---|---|---|
| frugal (+1) | 100 | 0.391 | 95.0% |
| mixed | 65 | 0.312 | 70.8% |
| spends freely (−1) | 107 | 0.198 | 34.6% |
| **none** | **723** | **0.344** | **87.1%** |

With no price signal at all it behaves as if the traveller were explicitly frugal. The same
prior sits in the deterministic fallback: `derivePersona`'s `BASE` is `price: 0.34`, and the
teacher's no-signal default is `0.344`.

## The prompt was the cause — before/after on the same 100 profiles

Same seed, same profiles, revised prompt (`training/_gate3-round1/`, 81 rows, $0.28):

| metric | original prompt | revised prompt |
|---|---|---|
| top-dimension entropy | 0.936 bits | **2.096** (of 2.322) |
| chance agreement | 0.678 | **0.245** |
| price-top marginal | 81.2% | **17.3%** |
| no-price-signal rows price-top | 87.1% | **10.9%** |
| mean max-weight | 0.361 | 0.298 |

| input \ label | price | quality | location | vibe | flexibility | n |
|---|---|---|---|---|---|---|
| price | **80%** | 0% | 0% | 20% | 0% | 5 |
| quality | 10% | **43%** | 5% | 33% | 10% | 21 |
| location | 10% | 0% | **90%** | 0% | 0% | 10 |
| vibe | 12% | 44% | 12% | **31%** | 0% | 16 |
| flexibility | 29% | 7% | 21% | 43% | **0%** | 14 |

Identical inputs and identical teacher model, so the prompt is the only variable that changed.
This is the strongest causal evidence in the project and the artifacts are kept for it.

Two regressions the same change introduced, both addressed in iteration 2: discards rose from
the teacher's 0.5% to 19% (every failure nested the object inside `preferences`), and explicitly
frugal rows fell from 95% to 45.5% price-top — a reversed prior rather than a symmetric response.

## `flexibility` is excluded from the diagonal gate — do not re-add it

`flexibility` is not a scoring axis. `packages/orchestrator/src/agents/match.ts` computes
`price + quality + location + vibe + verification`, and the flexibility weight enters only as

```ts
const priceWeight = w.price + w.flexibility * 0.5;
```

A "flexibility-top" label is therefore not a meaningful target: a persona with flexibility 0.40
and price 0.15 produces an effective price weight of 0.35, so gating on a flexibility diagonal
would manufacture the price-led rankings this work exists to remove. The gate checks the four
scored dimensions; the cross-tab still displays flexibility so the asymmetry stays visible.
`match.ts` was deliberately not modified and the fixture was deliberately not retagged.

A related ambiguity is left open: the fixture tags `dates are completely flexible` as
flexibility +1 (spontaneous-open), while the model read the same signal as lowering the weight
("this traveller does not need flexible options"). Both are defensible because no document
defines what a dimension's weight means. The definitions were deliberately NOT copied into the
prompt — doing so would make the diagonal partly circular, since prompt and tags would then
encode the same assumption.

## Future work

- **Is five dimensions the right shape at all?** One of the five is not scored, and one
  (`vibe`) is scored through a keyword-overlap proxy. A weight vector whose components are not
  commensurable is hard to distil and harder to evaluate. Open question; not acted on.
- **The training target, separately from the teacher.** The price polarity relationship is
  present in 107 train rows and the student learned none of it — independent evidence for the
  17:1 loss-dilution problem (`summary` is 80.9% of each label by characters, `weights` 4.7%).
  Fixing the teacher does not fix this; both are required.
- **`derivePersona`'s `BASE`** (`price: 0.34`) carries the same prior and is what production
  runs when the LLM path is off. Left alone pending the rule-symmetry work.

## The heuristic fallback had the same defect, worse — and had never been measured

`derivePersona` is what production runs when the LLM path is off. `training/heuristic_labels.mts`
runs it over a split into the same format the teacher pass writes, so the same degeneracy test
applies. On the 995-row train split it scored worse than the teacher it backs up, and its price
axis pointed the wrong way:

| price signal | n | mean price weight | price-top |
|---|---|---|---|
| frugal (+1) | 100 | 0.421 | 80.0% |
| **spends freely (−1)** | 107 | **0.431** | **83.2%** |

Two causes. The axis was one-way — one rule raised price (+0.4), only `/luxury/` lowered it
(−0.2) — so price could not leave the top without the word "luxury". And two regexes fired on
their own negation: `/budget/` matched *"treats the budget as a starting point, not a limit"*
and `/save/` matched *"has saved for this and wants to feel it"*, both price −1 signals pushing
price **up**. Separately, a hard budget added +0.2 to price, counting a constraint as a taste —
removable because `supervisor.ts` already prunes each partial against `budgetCap` before
expanding and bounds activities by what remains, so budget adherence never depended on it.

| | original | symmetric rules | + hard-budget rule removed |
|---|---|---|---|
| top-dimension entropy | 0.770 | 1.519 | **1.820** |
| chance agreement | 0.752 | 0.453 | **0.331** |
| price-top marginal | 86.2% | 63.5% | — |
| spends-freely mean price weight | 0.431 | 0.170 | **0.098** |
| no-price-signal rows price-top | — | 69.0% | **50.8%** |

`BASE` is deliberately unchanged. With the rules symmetric and the budget nudge gone, the
residual is cleanly attributable to it: rows with no price signal at all are still 50.8%
price-top, and `BASE.price` is 0.34 — the largest of the five. That is the next decision, and it
is now isolated.

**The bias was systemic, not one model's quirk.** The same price-first prior appears in three
independent places: the teacher's labels (81.2% price-top), the prompt that produced them, and
the deterministic fallback written long before any of this. Whatever produced it was a shared
assumption about what travellers care about, not a model defect.

---

# Round 2 — the fix, and what it cost to find

## The causal chain, end to end

One prompt defect produced everything else. It is worth stating as a chain because each link was
measured, not inferred:

1. **The prompt primed the answer.** It carried a worked example — *"a downstream human should be
   able to see why you weighted price over quality"* — and asked for the reasoning to be written
   into `summary`.
2. **The labels degenerated.** 81.2% of them came back price-top, entropy 0.936 of 2.322 bits.
   The teacher was not input-blind: it separated price correctly when told (0.391 frugal vs 0.198
   spends-freely). It defaulted. In the 723 rows with no price signal at all it answered as if
   the traveller were frugal (0.344, 87.1% price-top).
3. **The "noise floor" hid it.** Chance agreement under that marginal is 0.678; the recorded
   teacher-teacher agreement was 17/25 = 0.680. The floor was measuring the shared prior, so
   nothing about student rank agreement was interpretable against it.
4. **The loss diluted the part that mattered.** Because the reasoning went into `summary`, the
   labels were a median 385 tokens of which 79.8% was prose and 12.3% was `weights` — the only
   field the ranker consumes.
5. **The student collapsed.** It answered `price` on 242 of 243 rows, scored exactly the
   majority-class prior (175/243 = 72.0%, the same rows), and was beaten by a constant predictor
   (0.0587 vs 0.0565 MAE).

Links 2 and 4 are independent causes with a common origin, which is why they were fixed in
separate commits and why two students were trained.

## Gate rounds

Each round is 100–150 rows against the same profiles and seed, so only the prompt changes.

| | original | r1 | r2 | r3 | gate 4 | full pass |
|---|---|---|---|---|---|---|
| rows | 995 | 81 | 131 | 126 | 135 | **998** |
| top-dimension entropy (of 2.322) | 0.936 | 2.096 | 2.038 | 2.089 | 2.079 | **2.085** |
| chance agreement | 0.678 | 0.245 | 0.250 | 0.254 | 0.250 | **0.247** |
| price-top marginal | 81.2% | 17.3% | 26.0% | 19.8% | 20.0% | **18.7%** |
| no-price-signal price-top | 87.1% | 10.9% | 16.3% | 14.4% | 12.8% | **12.8%** |
| frugal price-top | 95.0% | 45.5% | 75.0% | 66.7% | 62.5% | **68.0%** |
| mean max-weight | 0.361 | 0.298 | 0.294 | 0.289 | 0.282 | **0.282** |
| discard rate | 0.5% | 19.0% | 12.7% | 16.0% | 10.2% | **0.2%** |
| diagonal: price | 67% | 80% | 80% | 57% | 78% | **41%** |
| quality | 12% | 43% | 33% | 43% | 36% | **39%** |
| location | 7% | 90% | 65% | 60% | 41% | **62%** |
| vibe | 2% | 31% | 48% | 32% | 36% | **45%** |

Two gate criteria were judged at small n and turned out to be noise, exactly as suspected:
`frugal price-top` read 45.5 → 75.0 → 66.7 → 62.5% at n≈12–16 and settled at **68.0%** at n=100;
`vibe` read 31 → 48 → 32 → 36% at n≈16–25 and settled at **45%** at n=195. Neither justified
another paid round.

The discard spike from 0.5% to 19% was self-inflicted: adding a `reasoning` array of
`{signal, dimension, direction}` objects gave models something to misplace. Three prompt
revisions telling them not to moved it 19.0 → 12.7 → 16.0% — flat. It was fixed structurally
instead (plain strings, a lenient wire schema, a deterministic hoist, and one required-field
instruction), ending at **0.2%** — better than the original teacher's 0.5%.

## The training target — and why the ablation narrowed

`summary` is prose the ranker never reads. Under token-level cross-entropy the weights receive a
share of the gradient proportional to their share of the label, so the round-1 target gave them
about an eighth of it.

Measured per-field share of assistant-label tokens (`make_variants.py`, base-model tokenizer):

| field | round-1 labels | round-2 (A) | round-2 (B) |
|---|---|---|---|
| `reasoning` | — (field did not exist) | 34.3% | 36.7% |
| `weights` | **12.3%** | **29.9%** | **32.2%** |
| `preferences` | 19.5% | 28.5% | 30.6% |
| `summary` | **79.8%** | 23.2% | 0% |
| median label length | 385 tokens | 160 | 149 |

**The prompt fix largely fixed the dilution too, unintentionally.** The old prompt asked for the
reasoning to be written into `summary`, which produced 385-token essays; the new one gives
reasoning its own field and asks for a one-line summary. `weights` went from 12.3% to 29.9% of
the target without touching the training target at all.

That narrows the A/B ablation: B's labels are only 7% shorter than A's, not 68%. The ablation is
still run and reported, but it is now a test of a small residual difference, and a null result
would mean the dilution was already fixed upstream — not that dilution never mattered.
