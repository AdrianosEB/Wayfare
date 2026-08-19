#!/usr/bin/env python3
"""Round-2 five-arm comparison table. `report.py` produced the round-1 single-student tables.

    ./.venv/bin/python report_arms.py --split test
    ./.venv/bin/python report_arms.py --split test-adversarial

Arms: heuristic (`derivePersona`) · untuned base · student-A · student-B · teacher.

Two reference predictors are computed from the teacher's own labels on the same split and
printed beside every arm, because *neither* of the obvious references survives round 1:

* **Constant predictor** — the teacher's mean weight vector for every row. Round 1's student
  lost to this (0.0587 vs 0.0565). Any arm that does not beat it has not learned a mapping,
  whatever its MAE looks like in isolation.
* **Majority-class predictor** — always answer the split's modal top dimension. Round 1's
  student scored *exactly* this, on the same rows. It is the number a top-dimension agreement
  has to clear to mean anything.

The measured teacher-teacher figure (17/25) is deliberately NOT printed as a floor. Round 2
established it equalled chance agreement under the round-1 marginal (0.680 vs 0.678), so it
bounded nothing; re-measuring it under the round-2 prompt needs API credits and has not been
done. Reporting it here would reintroduce the error the round-1 analysis exists to correct.

**Two agreement columns, two claims.** `top-dim agr.` is argmax match: did the arm name the same
single highest dimension. `rank agr.` is Spearman's rho and Kendall's tau-b over the full
five-dimension ordering, mean and median, with `n ranked` as its own denominator (rows where
either vector is entirely flat have no ordering and are excluded, not scored as zero). The
constant predictor's rank agreement is printed beside the arms for the same reason its MAE is:
one fixed ordering already correlates with the teacher's, and an arm has to clear that.

`schema-valid` is against each arm's target schema; `production` is against `PersonaSchema` as
the orchestrator enforces it. They differ only for student-B, which is trained without
`summary` — see `eval.py:build_records`.
"""

import argparse
import json
import statistics
from pathlib import Path

from eval import kendall_tau, spearman_rho
from report import agg, fmt, pct

DIMS = ["price", "quality", "location", "vibe", "flexibility"]
ARM_ORDER = ["heuristic", "baseline", "student-A", "student-B", "teacher"]
ARM_LABEL = {
    "heuristic": "heuristic (`derivePersona`)",
    "baseline": "untuned base",
    "student-A": "student-A (full label)",
    "student-B": "student-B (no `summary`)",
    "teacher": "teacher (reference)",
}


def teacher_refs(data_dir, split, records_by_index):
    """Constant- and majority-predictor scores over the same rows an arm actually scored.

    Computed per call against `records_by_index` so the reference and the arm share a
    denominator. A constant predictor evaluated over 250 rows is not a fair reference for an arm
    that produced 12 — round 1's baseline arm is exactly that case.
    """
    rows = [json.loads(l) for l in (Path(data_dir) / f"{split}.jsonl").open()]
    labels = []
    for r in rows:
        w = json.loads(r["messages"][2]["content"]).get("weights") or {}
        try:
            vals = [float(w[d]) for d in DIMS]
        except (KeyError, TypeError, ValueError):
            continue
        total = sum(vals)
        if total > 0:
            labels.append((r["meta"]["index"], [v / total for v in vals]))

    if not labels:
        return None
    mean_vec = [statistics.mean(v[i] for _, v in labels) for i in range(len(DIMS))]
    tops = [DIMS[max(range(len(DIMS)), key=lambda i: v[i])] for _, v in labels]
    modal = statistics.mode(tops)

    subset = [(idx, v) for idx, v in labels if idx in records_by_index]
    if not subset:
        return None
    const_mae = statistics.mean(
        sum(abs(a - b) for a, b in zip(mean_vec, v)) / len(DIMS) for _, v in subset)
    subset_tops = [DIMS[max(range(len(DIMS)), key=lambda i: v[i])] for _, v in subset]
    # Rank agreement needs a reference for the same reason MAE did. The constant predictor emits
    # one ordering for every row, so its rho against the teacher is not zero — it is whatever the
    # teacher's own ordering-vs-mean-ordering happens to be, and an arm that does not clear it
    # has learned nothing about ordering either.
    const_rhos = [r for r in (spearman_rho(mean_vec, v) for _, v in subset) if r is not None]
    const_taus = [t for t in (kendall_tau(mean_vec, v) for _, v in subset) if t is not None]
    return {
        "n": len(subset),
        "const_mae": const_mae,
        "const_rho": statistics.mean(const_rhos) if const_rhos else None,
        "const_rho_median": statistics.median(const_rhos) if const_rhos else None,
        "const_tau": statistics.mean(const_taus) if const_taus else None,
        "majority_dim": modal,
        "majority_agree_pct": pct(sum(1 for t in subset_tops if t == modal), len(subset_tops)),
        "mean_vec": dict(zip(DIMS, (round(x, 4) for x in mean_vec))),
    }


def row(name, a, arm_blob):
    prod = arm_blob and sum(1 for r in arm_blob["records"]
                            if r.get("schema_valid_production")) or 0
    prod_cell = (f"{fmt(pct(prod, a['n']), '.1f')}%"
                 if arm_blob and arm_blob.get("target_schema") != "PersonaSchema" else "same")
    return (f"| {ARM_LABEL.get(name, name)} | {a['n']} | "
            f"{fmt(a['schema_valid_pct'], '.1f')}% ({a['n_valid']}/{a['n']}) | {prod_cell} | "
            f"{a['n_scored']} | {fmt(a['norm_mae'], '.4f')} | {fmt(a['norm_mae_p95'], '.4f')} | "
            f"{fmt(a['top_agree_pct'], '.1f')}% | "
            f"{fmt(a['rho_mean'], '.3f')} / {fmt(a['rho_median'], '.3f')} | "
            f"{fmt(a['tau_mean'], '.3f')} / {fmt(a['tau_median'], '.3f')} | {a['n_rank']} | "
            f"{fmt(a['pace_agree_pct'], '.1f')}% | "
            f"{fmt(a['raw_sum_drift'], '.4f')} |")


HEADER = ("| arm | n | schema-valid | production schema | n scored | norm. MAE | MAE p95 | "
          "top-dim agr. (argmax) | rank agr. ρ mean/med | rank agr. τ mean/med | n ranked | "
          "pace agr. | raw-sum drift |")
RULE = "|---|---|---|---|---|---|---|---|---|---|---|---|---|"


def table(title, blobs, slice_name, data_dir, split, note=""):
    print(f"### {title}\n")
    if note:
        print(note + "\n")
    print(HEADER)
    print(RULE)
    ref_seen = None
    for name in ARM_ORDER:
        blob = blobs.get(name)
        if blob is None:
            continue
        a = agg(blob["records"], slice_name)
        if not a:
            continue
        print(row(name, a, blob))
        if name == "student-A":
            idxs = {r["index"] for r in blob["records"]
                    if (slice_name is None or r["slice"] == slice_name)}
            ref_seen = teacher_refs(data_dir, split, idxs)
    if ref_seen:
        print(f"\nReferences over the same {ref_seen['n']} rows — constant predictor (teacher "
              f"mean vector) MAE **{ref_seen['const_mae']:.4f}**, its rank agreement ρ "
              f"**{fmt(ref_seen['const_rho'], '.3f')}** / τ "
              f"**{fmt(ref_seen['const_tau'], '.3f')}**; majority-class predictor "
              f"(always `{ref_seen['majority_dim']}`) top-dim agreement "
              f"**{ref_seen['majority_agree_pct']:.1f}%**. An arm at or below the first, or at "
              f"the second, has not learned a mapping.")
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results-dir", default="./results")
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--split", default="test")
    args = ap.parse_args()

    d = Path(args.results_dir)
    blobs = {}
    for name in ARM_ORDER:
        p = d / f"{name}-{args.split}.json"
        if p.is_file():
            blobs[name] = json.loads(p.read_text())
    missing = [a for a in ARM_ORDER if a not in blobs]
    if missing:
        print(f"_Arms with no `{args.split}` results file: {', '.join(missing)}._\n")

    n = next(iter(blobs.values()))["n_rows"] if blobs else 0
    print(f"## Five-arm comparison — `{args.split}` split, {n} rows\n")

    table(f"`{args.split}` — whole split", blobs, None, args.data_dir, args.split)
    if args.split == "test":
        table("`test` — clean slice", blobs, "clean", args.data_dir, args.split,
              note="Slices are never averaged (measurement note). Reported separately, always.")
        table("`test` — conflict slice", blobs, "conflict", args.data_dir, args.split)

    for name in ARM_ORDER:
        blob = blobs.get(name)
        if not blob or blob.get("latency_p50_s") is None:
            continue
        print(f"- **{ARM_LABEL[name]}** latency (sequential, n={blob['latency_sample_n']}): "
              f"p50 {fmt(blob['latency_p50_s'], '.2f')}s · p95 {fmt(blob['latency_p95_s'], '.2f')}s")


if __name__ == "__main__":
    main()
