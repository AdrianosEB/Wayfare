#!/usr/bin/env python3
"""Phase 4 — score an arm (baseline / student) against the teacher's stored labels.

Writes one JSON file of per-row records per arm/split; `report.py` aggregates them into the
RESULTS.md tables. Splitting generation from aggregation means a re-run of the tables costs
nothing and never silently re-generates with different settings.

    ./.venv/bin/python eval.py --arm student  --model ./fused --split test
    ./.venv/bin/python eval.py --arm baseline --model mlx-community/Qwen2.5-1.5B-Instruct-4bit --split test

    # re-score predictions that already exist — no model load, no generation, no API spend
    ./.venv/bin/python eval.py --arm student-A --split test --rescore-from results/student-A-test.json

What the numbers mean, and what they deliberately do NOT do:

* Two different agreement metrics are reported over the weight vector and they are NOT the same
  claim. **Top-dimension agreement** (`top_match`) is argmax match: did the arm name the same
  single highest dimension as the teacher. **Rank agreement** (`spearman_rho`, `kendall_tau`) is
  ordinal correlation over all five dimensions: did it reproduce the teacher's whole ordering.
  An arm can score 100% on the first while ordering the remaining four dimensions at random.

* The teacher's stored `assistant` message is the reference. Rows are scored against it, so
  "MAE" is student-vs-teacher, never student-vs-truth — there is no ground truth here, only a
  teacher whose own schema-valid rate is 99.5% and whose top-dimension self-agreement ceiling
  is 17/25 (see RESULTS.md measurement notes). Both belong beside any number this produces.
* Weight metrics are computed ONLY over rows that produced schema-valid output. An arm that
  emits no JSON has an undefined MAE, not a good one — `n_scored` is recorded next to every
  metric so a small denominator can never masquerade as a strong result.
* Slices are tagged per row (`clean` / `conflict`) and never merged here. Aggregation keeps
  them apart; the measurement notes forbid averaging them.
* Latency from batched generation is meaningless per-request, so throughput mode records no
  latency at all. `--latency-sample N` re-runs N rows one at a time for honest p50/p95.
"""

import argparse
import json
import math
import statistics
import sys
import time
from pathlib import Path

from smoke_test import validate_persona

DIMS = ["price", "quality", "location", "vibe", "flexibility"]


def parse_output(text):
    """Return (obj, mode) where mode is 'bare' | 'extracted' | None.

    'extracted' means valid JSON was recovered from surrounding prose. The production path
    expects bare JSON, so the distinction is kept rather than smoothed over.
    """
    try:
        return json.loads(text), "bare"
    except json.JSONDecodeError:
        pass
    s, e = text.find("{"), text.rfind("}")
    if s != -1 and e > s:
        try:
            return json.loads(text[s:e + 1]), "extracted"
        except json.JSONDecodeError:
            return None, None
    return None, None


def avg_ranks(vals):
    """Average ranks, 1 = smallest. Tied values share the mean of the ranks they span.

    Ties are not a corner case here: five weights that must sum to 1 land on equal values
    often (0.20/0.20 is the single most common pair in the round-2 labels). Assigning tied
    dimensions an arbitrary order would manufacture agreement or disagreement out of the sort
    order, so both correlations below are computed on these averaged ranks.
    """
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    ranks = [0.0] * len(vals)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and vals[order[j + 1]] == vals[order[i]]:
            j += 1
        shared = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = shared
        i = j + 1
    return ranks


def spearman_rho(a, b):
    """Spearman's rho — Pearson correlation of the average ranks of the two weight vectors.

    Returns None, never 0.0, when either side is entirely tied: a flat vector expresses no
    ordering, so there is nothing for the other side to agree or disagree with. Rows where it
    is undefined are counted separately rather than folded in as neutral agreement.
    """
    ra, rb = avg_ranks(a), avg_ranks(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    da = [x - ma for x in ra]
    db = [x - mb for x in rb]
    na = math.sqrt(sum(x * x for x in da))
    nb = math.sqrt(sum(x * x for x in db))
    if na == 0 or nb == 0:
        return None
    # Clamped: the float division puts an exact match at 1.0000000000000002, and a correlation
    # printed above 1 invites a reader to distrust the rest of the column.
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(da, db)) / (na * nb)))


def kendall_tau(a, b):
    """Kendall's tau-b over the 10 dimension pairs — concordant minus discordant, tie-corrected.

    tau-b rather than tau-a for the same reason rho is computed on averaged ranks: pairs tied on
    either side are excluded from the numerator and shrink the denominator, instead of counting
    as disagreements. Undefined (None) on the same flat-vector case as rho.

    Reported beside rho because they answer slightly different questions on five points: rho
    weights how far a dimension moved in the ordering, tau counts how many pairwise
    relationships survived. A large gap between them on the same arm is informative.
    """
    n = len(a)
    n0 = n * (n - 1) / 2
    conc = disc = tied_a = tied_b = 0
    for i in range(n):
        for j in range(i + 1, n):
            da, db = a[i] - a[j], b[i] - b[j]
            if da == 0:
                tied_a += 1
            if db == 0:
                tied_b += 1
            s = da * db
            if s > 0:
                conc += 1
            elif s < 0:
                disc += 1
    den = math.sqrt((n0 - tied_a) * (n0 - tied_b))
    if den == 0:
        return None
    return (conc - disc) / den


def normalised(w):
    """Weights scaled to sum 1. Returns None if the sum is not usable."""
    try:
        vals = [float(w[d]) for d in DIMS]
    except (KeyError, TypeError, ValueError):
        return None
    total = sum(vals)
    if total <= 0:
        return None
    return [v / total for v in vals]


def score_row(pred, teacher):
    """Per-row comparison of a schema-valid prediction against the teacher's label."""
    pw, tw = pred.get("weights"), teacher.get("weights")
    pn, tn = normalised(pw), normalised(tw)
    if pn is None or tn is None:
        return None
    return {
        # Mean absolute error across the five dims after normalising both sides, so an arm is
        # not punished twice for a raw sum that drifts off 1.0 — that is reported separately.
        "norm_mae": sum(abs(a - b) for a, b in zip(pn, tn)) / len(DIMS),
        "top_pred": DIMS[max(range(len(DIMS)), key=lambda i: pn[i])],
        "top_teacher": DIMS[max(range(len(DIMS)), key=lambda i: tn[i])],
        "top_match": DIMS[max(range(len(DIMS)), key=lambda i: pn[i])]
                     == DIMS[max(range(len(DIMS)), key=lambda i: tn[i])],
        # Rank agreement over the WHOLE five-dimension ordering, which `top_match` above does
        # not measure: an arm can name the same top dimension and order the other four
        # backwards, and an arm can miss the top by a hair while reproducing the ordering
        # exactly. Both are reported; neither is a substitute for the other.
        "spearman_rho": spearman_rho(pn, tn),
        "kendall_tau": kendall_tau(pn, tn),
        "raw_sum": sum(float(pw[d]) for d in DIMS),
        "raw_sum_drift": abs(sum(float(pw[d]) for d in DIMS) - 1.0),
        "pace_pred": (pred.get("preferences") or {}).get("pace") if isinstance(pred.get("preferences"), dict) else None,
        "pace_teacher": (teacher.get("preferences") or {}).get("pace"),
    }


def build_records(rows, texts, require_summary=True):
    """Score each prediction against the teacher's stored label for the same row.

    Two validity verdicts are recorded, never one:

    * `schema_valid_production` — against `PersonaSchema` exactly as the orchestrator enforces
      it, `summary` required. This is the only verdict that says a model is deployable.
    * `schema_valid` — against the schema the arm was *trained for*, which for student-B is
      PersonaSchema minus `summary` (`make_variants.py` strips it). This is what gates whether
      weight metrics are computed, so arm B's MAE is measurable at all.

    They are identical for every arm except B. Keeping both means B's headline validity can
    never be read as a production pass, and B's MAE can never be silently undefined.
    """
    records = []
    for r, text in zip(rows, texts):
        teacher = json.loads(r["messages"][2]["content"])
        obj, mode = parse_output(text)
        if obj is None:
            errs = strict_errs = ["output did not parse as JSON"]
        else:
            errs = validate_persona(obj, require_summary=require_summary)
            strict_errs = errs if require_summary else validate_persona(obj, require_summary=True)
        rec = {
            "index": r["meta"]["index"],
            "slice": "conflict" if r["meta"].get("conflict") else "clean",
            "parse_mode": mode,
            "schema_valid": obj is not None and not errs,
            "schema_valid_production": obj is not None and not strict_errs,
            "errors": errs[:5],
            "output_chars": len(text),
            "output": text,
        }
        if rec["schema_valid"]:
            rec["scores"] = score_row(obj, teacher)
        records.append(rec)
    return records


def write_out(args, records, wall, latencies, inherit=None):
    """`inherit` carries a prior run's generation metadata through a re-score.

    A re-scored file describes the same generation it always did — same model, same wall clock,
    same latency sample. Recomputing those fields from a run that generated nothing would
    silently zero them, and a p50 of `null` beside real numbers reads as "not measured" rather
    than "not re-measured". They are copied forward; only the scores change.
    """
    out = {
        "arm": args.arm,
        "model": args.model or args.from_jsonl or (inherit or {}).get("model") or "",
        "split": args.split,
        "target_schema": "no-summary" if args.no_require_summary else "PersonaSchema",
        "n_rows": len(records),
        "max_tokens": args.max_tokens,
        "batch_size": args.batch_size,
        "batched_wall_seconds": round(wall, 1),
        "latency_sample_n": len(latencies),
        "latency_p50_s": round(statistics.median(latencies), 2) if latencies else None,
        # ceil, not int: at small n, int(n*0.95)-1 indexes the SMALLEST sample and reports a p95
        # below p50. Caught by a 2-row test run.
        "latency_p95_s": round(sorted(latencies)[min(len(latencies) - 1,
                                                     math.ceil(0.95 * len(latencies)) - 1)], 2)
        if latencies else None,
        "records": records,
    }
    if inherit:
        for k in ("max_tokens", "batch_size", "batched_wall_seconds",
                  "latency_sample_n", "latency_p50_s", "latency_p95_s"):
            out[k] = inherit.get(k, out[k])
        out["rescored_from"] = inherit.get("_path", "")
    outdir = Path(args.out_dir)
    outdir.mkdir(exist_ok=True)
    path = outdir / f"{args.arm}-{args.split}.json"
    path.write_text(json.dumps(out, indent=1))
    valid = sum(1 for r in records if r["schema_valid"])
    strict = sum(1 for r in records if r["schema_valid_production"])
    print(f"\nwrote {path}")
    print(f"schema-valid ({out['target_schema']}): {valid}/{len(records)} "
          f"({100 * valid / len(records):.1f}%)")
    if strict != valid:
        print(f"schema-valid (production PersonaSchema): {strict}/{len(records)} "
              f"({100 * strict / len(records):.1f}%)")
    return path


def self_test():
    """Hand-checkable cases for the two rank statistics. `eval.py --self-test`.

    There is no scipy in this environment (`requirements.txt` is mlx-lm only), so the
    correlations are implemented here and have to be checked against cases whose answers are
    known by hand rather than against a reference library. Every case below is one of those:
    perfect agreement, perfect inversion, the tie cases the five-dimension shape makes routine,
    and the flat vector that must come back undefined rather than 0.
    """
    a = [0.4, 0.3, 0.2, 0.06, 0.04]
    cases = [
        ("identical → +1", a, a, 1.0, 1.0),
        ("reversed → −1", a, a[::-1], -1.0, -1.0),
        ("tied pairs, same order → ±1", [0.3, 0.3, 0.2, 0.1, 0.1], [0.4, 0.4, 0.1, 0.05, 0.05], 1.0, 1.0),
        ("tied pairs, reversed → −1", [0.3, 0.3, 0.2, 0.1, 0.1], [0.1, 0.1, 0.2, 0.3, 0.3], -1.0, -1.0),
        # Three dimensions tied on both sides; the two that are not are inverted. Every pair
        # that carries information disagrees, so both statistics read a full inversion.
        ("tied middle, inverted ends → −1", [0.3, 0.2, 0.2, 0.2, 0.1], [0.1, 0.2, 0.2, 0.2, 0.3], -1.0, -1.0),
    ]
    fails = []
    for name, x, y, want_rho, want_tau in cases:
        got_rho, got_tau = spearman_rho(x, y), kendall_tau(x, y)
        if abs(got_rho - want_rho) > 1e-9 or abs(got_tau - want_tau) > 1e-9:
            fails.append(f"{name}: rho {got_rho} (want {want_rho}), tau {got_tau} (want {want_tau})")
        else:
            print(f"  ok  {name}: rho {got_rho:+.3f} tau {got_tau:+.3f}")
    flat = [0.2] * 5
    for name, x, y in (("flat prediction", flat, a), ("flat teacher", a, flat), ("both flat", flat, flat)):
        if spearman_rho(x, y) is not None or kendall_tau(x, y) is not None:
            fails.append(f"{name}: expected undefined, got {spearman_rho(x, y)}/{kendall_tau(x, y)}")
        else:
            print(f"  ok  {name}: undefined (not 0 — a flat vector expresses no ordering)")
    # Ranking must not depend on the scale, only the order: normalised() divides by the sum.
    if abs(spearman_rho([4, 3, 2, 1, 0], a) - 1.0) > 1e-9:
        fails.append("scale invariance: same ordering at a different scale did not score +1")
    else:
        print("  ok  scale invariance: ordering, not magnitude")
    if fails:
        print("\nFAIL:")
        for f in fails:
            print(f"  - {f}")
        raise SystemExit(1)
    print("\nPASS — rank statistics behave as specified.")


def build_prompt(tok, system, user):
    return tok.apply_chat_template(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        add_generation_prompt=True, tokenize=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true",
                    help="check the rank statistics against hand-computable cases and exit. "
                         "No model, no data, no arm required.")
    ap.add_argument("--arm", required=True,
                    choices=["baseline", "student", "student-A", "student-B", "heuristic", "teacher"])
    ap.add_argument("--model", default="")
    ap.add_argument("--from-jsonl",
                    help="score predictions already written to a dataset-format .jsonl instead "
                         "of generating them. Used for the heuristic arm (derivePersona, via "
                         "heuristic_labels.mts) and for any arm whose outputs were produced "
                         "elsewhere. Rows are matched on meta.index, not position.")
    ap.add_argument("--rescore-from",
                    help="re-score the stored predictions in a previous eval.py output file "
                         "instead of generating anything. Nothing is regenerated and no model "
                         "is loaded: the `output` string of every record is re-parsed and "
                         "re-scored against the same split's teacher labels, so a metric added "
                         "after a run costs nothing to backfill. Rows are matched on "
                         "meta.index; a mismatch aborts rather than scoring against the wrong "
                         "labels. Target schema is taken from the stored file unless "
                         "--no-require-summary is passed explicitly.")
    ap.add_argument("--allow-validity-change", action="store_true",
                    help="permit --rescore-from to write a file whose schema verdicts differ "
                         "from the stored ones. Off by default: a changed verdict means the "
                         "validator moved under the predictions, which is a different claim "
                         "from adding a metric to them.")
    ap.add_argument("--split", default="test")
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--out-dir", default="./results")
    ap.add_argument("--max-tokens", type=int, default=1200)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0, help="0 = all rows (use for smoke-checking this script)")
    ap.add_argument("--latency-sample", type=int, default=20,
                    help="rows re-run one at a time for honest p50/p95; 0 disables")
    ap.add_argument("--no-require-summary", action="store_true",
                    help="score against the arm-B target (PersonaSchema minus `summary`), which "
                         "is what make_variants.py trains student-B to emit. Validity against "
                         "the production schema is recorded separately either way.")
    # --self-test before parse_args' required=True on --arm would reject the bare invocation.
    if "--self-test" in sys.argv:
        self_test()
        return
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(Path(args.data_dir) / f"{args.split}.jsonl")]
    if args.limit:
        rows = rows[:args.limit]

    if args.rescore_from:
        src = Path(args.rescore_from)
        blob = json.loads(src.read_text())
        blob["_path"] = str(src)

        # The stored file records which schema its arm was scored against. Re-deriving it from
        # the CLI would score student-B against `PersonaSchema`, report 0% valid, and leave its
        # weight metrics undefined — the exact confusion `--no-require-summary` exists to avoid.
        if blob.get("target_schema") == "no-summary" and not args.no_require_summary:
            args.no_require_summary = True
            print(f"target schema taken from {src}: no-summary (arm trained without `summary`)")

        # Every guard here is a refusal to infer. A predictions file that is short, reordered,
        # or from a different split cannot be silently aligned against these labels: the whole
        # point of re-scoring is that the outputs are fixed, so any disagreement about which row
        # is which is a defect in the file, not something to paper over.
        preds, dupes = {}, []
        for rec in blob.get("records", []):
            if "output" not in rec or "index" not in rec:
                continue
            if rec["index"] in preds:
                dupes.append(rec["index"])
            preds[rec["index"]] = rec["output"]
        want = {r["meta"]["index"] for r in rows}
        missing, extra = sorted(want - set(preds)), sorted(set(preds) - want)
        problems = []
        if blob.get("arm") not in (None, args.arm) or blob.get("split") not in (None, args.split):
            problems.append(f"file is arm={blob.get('arm')} split={blob.get('split')}, "
                            f"invoked as arm={args.arm} split={args.split}")
        if dupes:
            problems.append(f"{len(dupes)} duplicated index/indices: {sorted(set(dupes))[:10]}")
        if missing:
            problems.append(f"{len(missing)} split row(s) with no stored prediction: {missing[:10]}")
        if extra:
            problems.append(f"{len(extra)} stored prediction(s) not in the split: {extra[:10]}")
        if problems:
            print(f"REFUSING to re-score {src} against {args.split}: " + "; ".join(problems))
            print("The stored predictions do not align with this split's labels. Skipping this "
                  "arm — scoring it would attribute one row's output to another row's label.")
            raise SystemExit(2)

        records = build_records(rows, [preds[r["meta"]["index"]] for r in rows],
                                require_summary=not args.no_require_summary)

        # A re-score must reproduce the stored verdicts exactly. If it does not, the schema this
        # file was scored under is not the schema `validate_persona` enforces today, and the run
        # is comparing predictions against a moved goalpost rather than adding a metric. Caught
        # for real: round 1's predictions predate the `reasoning` field, so re-scoring them under
        # the round-2 validator reported 0/248 schema-valid against a stored 243/248 — and would
        # have overwritten the round-1 record with it.
        was = {r["index"]: (r.get("schema_valid"), r.get("schema_valid_production"))
               for r in blob.get("records", [])}
        changed = [r["index"] for r in records
                   if r["index"] in was
                   and was[r["index"]] != (r["schema_valid"], r["schema_valid_production"])]
        if changed and not args.allow_validity_change:
            print(f"REFUSING to re-score {src}: the validator now disagrees with the stored "
                  f"schema verdict on {len(changed)}/{len(records)} row(s): {changed[:10]}"
                  f"{'…' if len(changed) > 10 else ''}")
            print("These predictions were scored under a different schema than `smoke_test."
                  "validate_persona` enforces now. Re-scoring would silently restate the arm's "
                  "validity, not just add a metric. Skipping this arm; pass "
                  "--allow-validity-change only if the restatement is the intent.")
            raise SystemExit(3)

        print(f"re-scored {len(records)} stored predictions from {src} — nothing regenerated"
              + (f"; {len(changed)} validity verdict(s) restated (--allow-validity-change)"
                 if changed else "; every stored schema verdict reproduced exactly"))
        write_out(args, records, wall=0.0, latencies=[], inherit=blob)
        return

    if args.from_jsonl:
        # No model, no latency: the predictions already exist. Matched on meta.index so a
        # predictions file that is reordered or partial cannot silently misalign rows against
        # the wrong teacher label.
        preds = {}
        for line in open(args.from_jsonl):
            r = json.loads(line)
            preds[r["meta"]["index"]] = r["messages"][2]["content"]
        missing = [r["meta"]["index"] for r in rows if r["meta"]["index"] not in preds]
        if missing:
            print(f"WARNING: {len(missing)} row(s) have no prediction and are excluded: "
                  f"{missing[:10]}{'…' if len(missing) > 10 else ''}")
        rows = [r for r in rows if r["meta"]["index"] in preds]
        texts = [preds[r["meta"]["index"]] for r in rows]
        records = build_records(rows, texts, require_summary=not args.no_require_summary)
        write_out(args, records, wall=0.0, latencies=[])
        return

    from mlx_lm import load, batch_generate, generate

    print(f"arm={args.arm} model={args.model} split={args.split} rows={len(rows)}")
    model, tok = load(args.model)

    prompts = [build_prompt(tok, r["messages"][0]["content"], r["messages"][1]["content"]) for r in rows]
    encoded = [tok.encode(p) for p in prompts]

    texts = []
    t0 = time.time()
    for i in range(0, len(encoded), args.batch_size):
        chunk = encoded[i:i + args.batch_size]
        resp = batch_generate(model, tok, prompts=chunk, max_tokens=args.max_tokens, verbose=False)
        texts.extend(resp.texts)
        done = min(i + args.batch_size, len(encoded))
        print(f"  {done}/{len(encoded)}  ({time.time() - t0:.0f}s elapsed)", flush=True)
    wall = time.time() - t0

    records = build_records(rows, texts, require_summary=not args.no_require_summary)

    # Latency, measured one row at a time — batched timings say nothing about per-request cost.
    latencies = []
    if args.latency_sample:
        n = min(args.latency_sample, len(prompts))
        print(f"  latency sample: {n} rows, sequential")
        for p in prompts[:n]:
            s = time.time()
            generate(model, tok, prompt=p, max_tokens=args.max_tokens, verbose=False)
            latencies.append(time.time() - s)

    write_out(args, records, wall, latencies)
    print(f"batched wall {wall:.0f}s")


if __name__ == "__main__":
    main()
