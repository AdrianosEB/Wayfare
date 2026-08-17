#!/usr/bin/env python3
"""Aggregate eval.py output into the RESULTS.md tables.

    ./.venv/bin/python report.py            # markdown to stdout
    ./.venv/bin/python report.py --worst 6  # + the worst student rows beside the teacher's

Reporting rules enforced here rather than left to whoever writes the prose — every one of them
comes from a measurement note in RESULTS.md, and each is easy to violate by accident:

* Slices are never merged. `clean` and `conflict` are reported as separate rows, always.
* Student schema-validity is stated against the teacher's own **99.5%**, not against 100%.
* Rank agreement is stated against the **majority-class predictor**, not against the
  teacher-teacher 17/25. That figure was retracted in round 1: chance agreement under the
  round-1 marginal is 0.678 and 17/25 is 0.680, so it measured the shared prior and bounded
  nothing (RESULTS.md measurement note 3). `report_arms.py` computes the round-2 references.
* The untuned baseline is printed in its own block, never as a row beside the student. It emits
  no JSON at all, so a near-zero denominator would otherwise make any student number look
  spectacular by comparison — the headline comparison is student vs teacher.
* Metrics over schema-valid rows carry their own `n`. An arm scoring 3 valid rows out of 248
  does not get to show a competitive MAE without that being visible.
"""

import argparse
import json
import statistics
from pathlib import Path

# From RESULTS.md measurement notes / STATE.md — measured, not assumed.
TEACHER_SCHEMA_VALID = 99.5      # 7 discards in 1,429 attempts, single cause
# Opus 4.8 vs Sonnet 5 on the same 25 profiles. RETAINED AS A FACT, NOT USED AS A FLOOR: it
# equals chance agreement under the round-1 marginal (0.680 vs 0.678). Kept so the retraction
# stays legible next to the number that caused it.
TEACHER_TEACHER_AGREE = 17 / 25
ROUND1_CHANCE_AGREEMENT = 0.678
TEACHER_TOKENS_IN, TEACHER_TOKENS_OUT, TEACHER_ROWS = 464_683, 634_764, 1_429
TEACHER_COST_USD = 7.28          # Sonnet 5 intro pricing, $2/$10 per M


def pct(n, d):
    return None if not d else 100.0 * n / d


def agg(records, slice_name=None):
    rs = [r for r in records if slice_name is None or r["slice"] == slice_name]
    if not rs:
        return None
    valid = [r for r in rs if r["schema_valid"]]
    scored = [r["scores"] for r in valid if r.get("scores")]
    extracted = sum(1 for r in rs if r["parse_mode"] == "extracted")
    return {
        "n": len(rs),
        "n_valid": len(valid),
        "schema_valid_pct": pct(len(valid), len(rs)),
        "n_scored": len(scored),
        "norm_mae": statistics.mean(s["norm_mae"] for s in scored) if scored else None,
        "norm_mae_p95": sorted(s["norm_mae"] for s in scored)[int(0.95 * len(scored))] if len(scored) > 2 else None,
        "top_agree_pct": pct(sum(1 for s in scored if s["top_match"]), len(scored)) if scored else None,
        "raw_sum_drift": statistics.mean(s["raw_sum_drift"] for s in scored) if scored else None,
        "pace_agree_pct": pct(sum(1 for s in scored if s["pace_pred"] == s["pace_teacher"]), len(scored)) if scored else None,
        "extracted_from_prose": extracted,
    }


def fmt(v, spec=".3f", dash="—"):
    return dash if v is None else format(v, spec)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results-dir", default="./results")
    ap.add_argument("--split", default="test")
    ap.add_argument("--worst", type=int, default=6)
    ap.add_argument("--data-dir", default="./data")
    args = ap.parse_args()

    d = Path(args.results_dir)
    arms = {}
    for name in ("student", "baseline"):
        p = d / f"{name}-{args.split}.json"
        if p.is_file():
            arms[name] = json.loads(p.read_text())

    if "student" not in arms:
        print(f"no student results in {d} — run eval.py first")
        return

    st = arms["student"]
    print(f"## Student vs teacher — `{args.split}` split, {st['n_rows']} rows\n")
    print(f"Student = LoRA iter-800, fused. Reference = the teacher's stored label for the same "
          f"input. Teacher's own schema-valid rate is **{TEACHER_SCHEMA_VALID}%**. The "
          f"teacher-teacher figure of 17/25 ({100*TEACHER_TEACHER_AGREE:.0f}%) is NOT a floor "
          f"here — it equals chance agreement under this marginal "
          f"({ROUND1_CHANCE_AGREEMENT}), so it bounds nothing.\n")
    print("| slice | n | schema-valid (teacher 99.5%) | norm. MAE | MAE p95 | top-dim agr. (vs prior, not a floor) | pace agr. | raw-sum drift |")
    print("|---|---|---|---|---|---|---|---|")
    for sl in ("clean", "conflict"):
        a = agg(st["records"], sl)
        if not a:
            continue
        print(f"| {sl} | {a['n']} | {fmt(a['schema_valid_pct'], '.1f')}% ({a['n_valid']}/{a['n']}) | "
              f"{fmt(a['norm_mae'], '.4f')} | {fmt(a['norm_mae_p95'], '.4f')} | "
              f"{fmt(a['top_agree_pct'], '.1f')}% | {fmt(a['pace_agree_pct'], '.1f')}% | "
              f"{fmt(a['raw_sum_drift'], '.4f')} |")
    print(f"\nLatency (sequential sample, n={st['latency_sample_n']}): "
          f"p50 {fmt(st['latency_p50_s'], '.2f')}s · p95 {fmt(st['latency_p95_s'], '.2f')}s. "
          f"Local inference — no API spend. Teacher: ${TEACHER_COST_USD} for {TEACHER_ROWS} rows "
          f"= **${1000 * TEACHER_COST_USD / TEACHER_ROWS:.2f}/1k**.\n")

    if "baseline" in arms:
        b = arms["baseline"]
        ab = agg(b["records"])
        print("### Context only — untuned baseline\n")
        print(f"Reported separately by design: the untuned base emits prose, not JSON, so its "
              f"schema-valid rate is a floor, and comparing the student against it would inflate "
              f"the student's apparent result. The headline is student vs teacher above.\n")
        print(f"- schema-valid: **{fmt(ab['schema_valid_pct'], '.1f')}%** ({ab['n_valid']}/{ab['n']})")
        print(f"- rows where JSON had to be extracted from surrounding prose: {ab['extracted_from_prose']}")
        if ab["n_scored"]:
            print(f"- norm. MAE over the {ab['n_scored']} scorable row(s): {fmt(ab['norm_mae'], '.4f')} "
                  f"— **not comparable** to the student's, computed over a different and much "
                  f"smaller denominator")
        else:
            print(f"- norm. MAE: **undefined** — no schema-valid rows to score. Not zero, not "
                  f"missing data: the arm produced nothing measurable on this axis.")
        print()

    # ---- worst student rows -------------------------------------------------
    if args.worst:
        rows = {json.loads(l)["meta"]["index"]: json.loads(l)
                for l in open(Path(args.data_dir) / f"{args.split}.jsonl")}
        invalid = [r for r in st["records"] if not r["schema_valid"]]
        scored = sorted([r for r in st["records"] if r.get("scores")],
                        key=lambda r: -r["scores"]["norm_mae"])
        worst = (invalid + scored)[:args.worst]
        print(f"### {len(worst)} worst student outputs\n")
        print("Ranked schema-invalid first, then by normalised MAE descending.\n")
        for r in worst:
            src = rows[r["index"]]
            teacher = json.loads(src["messages"][2]["content"])
            s = r.get("scores")
            print(f"**row {r['index']} · {r['slice']}**" +
                  (f" · MAE {s['norm_mae']:.4f} · top {s['top_pred']} vs teacher {s['top_teacher']}"
                   if s else " · SCHEMA-INVALID: " + "; ".join(r["errors"][:2])))
            print(f"- signals: {src['meta']['signals']}")
            if s:
                print(f"- student weights: {json.dumps(json.loads(r['output'])['weights'])}")
                print(f"- teacher weights: {json.dumps(teacher['weights'])}")
            else:
                print(f"- student emitted ({r['output_chars']} chars): {r['output'][:200]!r}...")
            print()


if __name__ == "__main__":
    main()
