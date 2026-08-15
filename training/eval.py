#!/usr/bin/env python3
"""Phase 4 — score an arm (baseline / student) against the teacher's stored labels.

Writes one JSON file of per-row records per arm/split; `report.py` aggregates them into the
RESULTS.md tables. Splitting generation from aggregation means a re-run of the tables costs
nothing and never silently re-generates with different settings.

    ./.venv/bin/python eval.py --arm student  --model ./fused --split test
    ./.venv/bin/python eval.py --arm baseline --model mlx-community/Qwen2.5-1.5B-Instruct-4bit --split test

What the numbers mean, and what they deliberately do NOT do:

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
        "raw_sum": sum(float(pw[d]) for d in DIMS),
        "raw_sum_drift": abs(sum(float(pw[d]) for d in DIMS) - 1.0),
        "pace_pred": (pred.get("preferences") or {}).get("pace") if isinstance(pred.get("preferences"), dict) else None,
        "pace_teacher": (teacher.get("preferences") or {}).get("pace"),
    }


def build_records(rows, texts):
    """Score each prediction against the teacher's stored label for the same row."""
    records = []
    for r, text in zip(rows, texts):
        teacher = json.loads(r["messages"][2]["content"])
        obj, mode = parse_output(text)
        errs = validate_persona(obj) if obj is not None else ["output did not parse as JSON"]
        rec = {
            "index": r["meta"]["index"],
            "slice": "conflict" if r["meta"].get("conflict") else "clean",
            "parse_mode": mode,
            "schema_valid": obj is not None and not errs,
            "errors": errs[:5],
            "output_chars": len(text),
            "output": text,
        }
        if rec["schema_valid"]:
            rec["scores"] = score_row(obj, teacher)
        records.append(rec)
    return records


def write_out(args, records, wall, latencies):
    out = {
        "arm": args.arm,
        "model": args.model or args.from_jsonl or "",
        "split": args.split,
        "n_rows": len(records),
        "max_tokens": args.max_tokens,
        "batch_size": args.batch_size,
        "batched_wall_seconds": round(wall, 1),
        "latency_sample_n": len(latencies),
        "latency_p50_s": round(statistics.median(latencies), 2) if latencies else None,
        "latency_p95_s": round(sorted(latencies)[min(len(latencies) - 1,
                                                     math.ceil(0.95 * len(latencies)) - 1)], 2)
        if latencies else None,
        "records": records,
    }
    outdir = Path(args.out_dir)
    outdir.mkdir(exist_ok=True)
    path = outdir / f"{args.arm}-{args.split}.json"
    path.write_text(json.dumps(out, indent=1))
    valid = sum(1 for r in records if r["schema_valid"])
    print(f"\nwrote {path}")
    print(f"schema-valid: {valid}/{len(records)} ({100 * valid / len(records):.1f}%)")
    return path


def build_prompt(tok, system, user):
    return tok.apply_chat_template(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        add_generation_prompt=True, tokenize=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", required=True,
                    choices=["baseline", "student", "student-A", "student-B", "heuristic", "teacher"])
    ap.add_argument("--model", default="")
    ap.add_argument("--from-jsonl",
                    help="score predictions already written to a dataset-format .jsonl instead "
                         "of generating them. Used for the heuristic arm (derivePersona, via "
                         "heuristic_labels.mts) and for any arm whose outputs were produced "
                         "elsewhere. Rows are matched on meta.index, not position.")
    ap.add_argument("--split", default="test")
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--out-dir", default="./results")
    ap.add_argument("--max-tokens", type=int, default=1200)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0, help="0 = all rows (use for smoke-checking this script)")
    ap.add_argument("--latency-sample", type=int, default=20,
                    help="rows re-run one at a time for honest p50/p95; 0 disables")
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(Path(args.data_dir) / f"{args.split}.jsonl")]
    if args.limit:
        rows = rows[:args.limit]

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
        records = build_records(rows, texts)
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

    records = []
    for r, text in zip(rows, texts):
        teacher = json.loads(r["messages"][2]["content"])
        obj, mode = parse_output(text)
        errs = validate_persona(obj) if obj is not None else ["output did not parse as JSON"]
        rec = {
            "index": r["meta"]["index"],
            "slice": "conflict" if r["meta"].get("conflict") else "clean",
            "parse_mode": mode,
            "schema_valid": obj is not None and not errs,
            "errors": errs[:5],
            "output_chars": len(text),
            "output": text,
        }
        if rec["schema_valid"]:
            rec["scores"] = score_row(obj, teacher)
        records.append(rec)

    # Latency, measured one row at a time — batched timings say nothing about per-request cost.
    latencies = []
    if args.latency_sample:
        n = min(args.latency_sample, len(prompts))
        print(f"  latency sample: {n} rows, sequential")
        for p in prompts[:n]:
            s = time.time()
            generate(model, tok, prompt=p, max_tokens=args.max_tokens, verbose=False)
            latencies.append(time.time() - s)

    out = {
        "arm": args.arm,
        "model": args.model,
        "split": args.split,
        "n_rows": len(records),
        "max_tokens": args.max_tokens,
        "batch_size": args.batch_size,
        "batched_wall_seconds": round(wall, 1),
        "latency_sample_n": len(latencies),
        "latency_p50_s": round(statistics.median(latencies), 2) if latencies else None,
        # ceil, not int: at small n, int(n*0.95)-1 indexes the SMALLEST sample and reports a p95
        # below p50. Caught by a 2-row test run.
        "latency_p95_s": round(sorted(latencies)[min(len(latencies) - 1,
                                                     math.ceil(0.95 * len(latencies)) - 1)], 2) if latencies else None,
        "records": records,
    }
    outdir = Path(args.out_dir)
    outdir.mkdir(exist_ok=True)
    path = outdir / f"{args.arm}-{args.split}.json"
    path.write_text(json.dumps(out, indent=1))

    valid = sum(1 for r in records if r["schema_valid"])
    print(f"\nwrote {path}")
    print(f"schema-valid: {valid}/{len(records)} ({100 * valid / len(records):.1f}%)  "
          f"batched wall {wall:.0f}s")


if __name__ == "__main__":
    main()
