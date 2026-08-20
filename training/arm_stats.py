#!/usr/bin/env python3
"""Did an arm beat the reference predictors, and is the difference bigger than the noise?

    ./.venv/bin/python arm_stats.py --split test

Round 1 established the two comparisons that matter, because both of the obvious ones failed:
a constant predictor beat the student on MAE, and the student's top-dimension agreement equalled
the majority-class prior *on the same rows*. Round 2 has to answer the same two questions with
intervals, because the round-2 gaps are small enough that an unqualified "beats"/"loses" would
be reading noise.

Three things are computed per arm, all paired row-by-row against the reference on exactly the
rows that arm scored:

* **MAE vs the constant predictor** (teacher mean vector). Paired difference with a bootstrap
  95% CI over rows. Paired, not two independent means: the same row is easy or hard for both
  predictors, and pairing removes that shared variance.
* **Top-dimension agreement vs the majority-class predictor.** Difference in proportions with a
  bootstrap CI, again paired. This is argmax match on one dimension — not rank agreement.
* **Rank agreement vs the constant predictor.** Mean Spearman's rho over the full
  five-dimension ordering, paired against the constant predictor's rho on the same rows. Added
  after round 2 because the document's claim that the arms "get the ordering right" was never
  measured over the ordering — it was inferred from argmax match, which is a different claim.
  Rows where either vector is flat have no ordering and are dropped from the pairing.
* **Distinct weight vectors** emitted. Round 1's student produced 24 distinct vectors over 243
  rows with one covering 93 of them, against the teacher's 157 — the collapse was visible here
  before any metric caught it.

The bootstrap is seeded so the CI is reproducible; resampling rows (not residuals) keeps it
valid without assuming the per-row errors are anything in particular.
"""

import argparse
import collections
import json
import random
import statistics
from pathlib import Path

from eval import spearman_rho

DIMS = ["price", "quality", "location", "vibe", "flexibility"]
ARMS = ["heuristic", "baseline", "student-A", "student-B"]


def norm(w):
    try:
        vals = [float(w[d]) for d in DIMS]
    except (KeyError, TypeError, ValueError):
        return None
    t = sum(vals)
    return [v / t for v in vals] if t > 0 else None


def mae(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(DIMS)


def top(v):
    return DIMS[max(range(len(DIMS)), key=lambda i: v[i])]


def boot_ci(pairs, stat, n=5000, seed=20260814):
    """Bootstrap CI over resampled ROWS. `pairs` is a list of per-row (arm, ref) values."""
    rng = random.Random(seed)
    k = len(pairs)
    if k < 2:
        return (None, None)
    draws = []
    for _ in range(n):
        sample = [pairs[rng.randrange(k)] for _ in range(k)]
        draws.append(stat(sample))
    draws.sort()
    return (draws[int(0.025 * n)], draws[int(0.975 * n) - 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results-dir", default="./results")
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--split", default="test")
    args = ap.parse_args()

    rows = {}
    for line in (Path(args.data_dir) / f"{args.split}.jsonl").open():
        r = json.loads(line)
        v = norm(json.loads(r["messages"][2]["content"]).get("weights") or {})
        if v:
            rows[r["meta"]["index"]] = v

    mean_vec = [statistics.mean(v[i] for v in rows.values()) for i in range(len(DIMS))]
    modal = statistics.mode([top(v) for v in rows.values()])
    print(f"## Against the reference predictors — `{args.split}`\n")
    print(f"Constant predictor = teacher mean vector "
          f"{ {d: round(x, 3) for d, x in zip(DIMS, mean_vec)} }. "
          f"Majority-class predictor = always `{modal}`.\n")
    print("| arm | n | MAE | constant | Δ MAE (95% CI) | top-dim | majority | Δ top-dim (95% CI) | "
          "rank ρ | constant ρ | n ranked | Δ ρ (95% CI) | distinct vectors | modal vector share |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")

    for arm in ARMS:
        p = Path(args.results_dir) / f"{arm}-{args.split}.json"
        if not p.is_file():
            continue
        blob = json.loads(p.read_text())
        pairs, rank_pairs, vecs = [], [], []
        for rec in blob["records"]:
            if not rec["schema_valid"] or rec["index"] not in rows:
                continue
            s, e = rec["output"].find("{"), rec["output"].rfind("}")
            pred = norm((json.loads(rec["output"][s:e + 1]).get("weights")) or {})
            if pred is None:
                continue
            ref = rows[rec["index"]]
            pairs.append((mae(pred, ref), mae(mean_vec, ref),
                          top(pred) == top(ref), top(ref) == modal))
            # Paired only where BOTH sides have an ordering to compare. Substituting 0 for an
            # undefined rho would score a flat prediction as "no agreement" when the honest
            # reading is "no ordering was expressed".
            a_rho, c_rho = spearman_rho(pred, ref), spearman_rho(mean_vec, ref)
            if a_rho is not None and c_rho is not None:
                rank_pairs.append((a_rho, c_rho))
            vecs.append(tuple(round(x, 4) for x in pred))

        if not pairs:
            print(f"| {arm} | 0 | — | — | — | — | — | — | — | — | — | — | — | — |")
            continue

        arm_mae = statistics.mean(a for a, _, _, _ in pairs)
        con_mae = statistics.mean(b for _, b, _, _ in pairs)
        arm_top = 100 * statistics.mean(1 if c else 0 for _, _, c, _ in pairs)
        maj_top = 100 * statistics.mean(1 if d else 0 for _, _, _, d in pairs)
        lo_m, hi_m = boot_ci(pairs, lambda s: statistics.mean(a - b for a, b, _, _ in s))
        lo_t, hi_t = boot_ci(pairs, lambda s: 100 * statistics.mean(
            (1 if c else 0) - (1 if d else 0) for _, _, c, d in s))
        counts = collections.Counter(vecs)
        share = 100 * counts.most_common(1)[0][1] / len(vecs)
        if rank_pairs:
            arm_rho = statistics.mean(a for a, _ in rank_pairs)
            con_rho = statistics.mean(b for _, b in rank_pairs)
            lo_r, hi_r = boot_ci(rank_pairs, lambda s: statistics.mean(a - b for a, b in s))
            rank_cells = (f"{arm_rho:.3f} | {con_rho:.3f} | {len(rank_pairs)} | "
                          f"{arm_rho - con_rho:+.3f} ({lo_r:+.3f}, {hi_r:+.3f})")
        else:
            rank_cells = "— | — | 0 | —"
        print(f"| {arm} | {len(pairs)} | {arm_mae:.4f} | {con_mae:.4f} | "
              f"{arm_mae - con_mae:+.4f} ({lo_m:+.4f}, {hi_m:+.4f}) | "
              f"{arm_top:.1f}% | {maj_top:.1f}% | "
              f"{arm_top - maj_top:+.1f}pp ({lo_t:+.1f}, {hi_t:+.1f}) | {rank_cells} | "
              f"{len(counts)} | {share:.1f}% |")

    print(f"\nΔ MAE is arm minus constant, so **negative is better**. Δ top-dim is arm minus "
          f"majority-class, so **positive is better**; it is argmax match on one dimension. "
          f"Δ ρ is arm minus constant on Spearman's rho over all five dimensions, so **positive "
          f"is better** — a different question from Δ top-dim, and it can point the other way. "
          f"A CI spanning zero means the arm is not distinguishable from that reference on this "
          f"split — which is a finding, not a missing result.")

    # ---- the ablation itself: A vs B, paired on rows both arms scored ----------------
    # Comparing each arm to the references separately cannot answer "did removing `summary`
    # help": two overlapping CIs against a third quantity is not a test of the difference.
    # This pairs A and B on the same rows and bootstraps the difference directly.
    preds = {}
    for arm in ("student-A", "student-B"):
        p = Path(args.results_dir) / f"{arm}-{args.split}.json"
        if not p.is_file():
            return
        preds[arm] = {}
        for rec in json.loads(p.read_text())["records"]:
            if not rec["schema_valid"] or rec["index"] not in rows:
                continue
            s, e = rec["output"].find("{"), rec["output"].rfind("}")
            v = norm((json.loads(rec["output"][s:e + 1]).get("weights")) or {})
            if v:
                preds[arm][rec["index"]] = v

    shared = sorted(set(preds["student-A"]) & set(preds["student-B"]))
    if not shared:
        return
    pairs = [(mae(preds["student-A"][i], rows[i]), mae(preds["student-B"][i], rows[i]),
              top(preds["student-A"][i]) == top(rows[i]),
              top(preds["student-B"][i]) == top(rows[i])) for i in shared]
    rank_pairs = [(spearman_rho(preds["student-A"][i], rows[i]),
                   spearman_rho(preds["student-B"][i], rows[i])) for i in shared]
    rank_pairs = [(a, b) for a, b in rank_pairs if a is not None and b is not None]
    d_mae = statistics.mean(a - b for a, b, _, _ in pairs)
    d_top = 100 * statistics.mean((1 if c else 0) - (1 if d else 0) for _, _, c, d in pairs)
    lo_m, hi_m = boot_ci(pairs, lambda s: statistics.mean(a - b for a, b, _, _ in s))
    lo_t, hi_t = boot_ci(pairs, lambda s: 100 * statistics.mean(
        (1 if c else 0) - (1 if d else 0) for _, _, c, d in s))
    print(f"\n### The ablation — student-A vs student-B, paired on {len(shared)} shared rows\n")
    print("| measure | A | B | Δ (A − B) | 95% CI | reading |")
    print("|---|---|---|---|---|---|")
    a_mae = statistics.mean(a for a, _, _, _ in pairs)
    b_mae = statistics.mean(b for _, b, _, _ in pairs)
    a_top = 100 * statistics.mean(1 if c else 0 for _, _, c, _ in pairs)
    b_top = 100 * statistics.mean(1 if d else 0 for _, _, _, d in pairs)
    verdict = lambda lo, hi: "**difference is real**" if (lo > 0) == (hi > 0) else "null — CI spans zero"
    print(f"| norm. MAE | {a_mae:.4f} | {b_mae:.4f} | {d_mae:+.4f} | ({lo_m:+.4f}, {hi_m:+.4f}) | "
          f"{verdict(lo_m, hi_m)} |")
    print(f"| top-dim agr. (argmax) | {a_top:.1f}% | {b_top:.1f}% | {d_top:+.1f}pp | ({lo_t:+.1f}, {hi_t:+.1f}) | "
          f"{verdict(lo_t, hi_t)} |")
    if rank_pairs:
        a_rho = statistics.mean(a for a, _ in rank_pairs)
        b_rho = statistics.mean(b for _, b in rank_pairs)
        lo_r, hi_r = boot_ci(rank_pairs, lambda s: statistics.mean(a - b for a, b in s))
        print(f"| rank agr. ρ (n={len(rank_pairs)}) | {a_rho:.3f} | {b_rho:.3f} | "
              f"{a_rho - b_rho:+.3f} | ({lo_r:+.3f}, {hi_r:+.3f}) | {verdict(lo_r, hi_r)} |")


if __name__ == "__main__":
    main()
