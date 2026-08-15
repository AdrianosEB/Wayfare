#!/usr/bin/env python3
"""Is the teacher's label actually a function of the input? Run this on ANY teacher pass.

    ./.venv/bin/python diagnose_labels.py                     # all splits
    ./.venv/bin/python diagnose_labels.py --split train --gate

Phase 4 found a student whose predicted weights were independent of its input. The student was
not the problem: it faithfully reproduced labels that are themselves near-independent of the
input. This script measures that directly, on the labels alone, with no model involved — so it
can run *before* any training spend rather than after.

Each authored signal in `fixtures/persona-signals.json` carries `d`, the PersonaWeights
dimension it is meant to move. Join a row's signals back to those tags and you know which
dimension the input is *about*; the teacher's argmax weight says which dimension the label is
about. If the teacher is reading the input, those agree well above chance and the cross-tab has
a strong diagonal. If it is answering from a prior, the diagonal is flat and the marginal is
concentrated.

Two numbers matter most:

* **Top-dimension entropy** (bits, max log2(5) = 2.32). Low entropy means the label barely
  varies no matter what goes in.
* **Chance agreement** = the sum of squares of the top-dimension marginal — the rate at which
  two independent draws from that marginal agree by luck. Any observed agreement between two
  labellers must be read against THIS, not against zero. A "noise floor" that merely reproduces
  the chance rate is not measuring labeller noise at all.

`--gate` turns it into a pass/fail check (non-zero exit on failure) for use before a full pass.
"""

import argparse
import collections
import json
import math
from pathlib import Path

DIMS = ["price", "quality", "location", "vibe", "flexibility"]
REPO = Path(__file__).resolve().parent.parent
FIXTURES = REPO / "packages/orchestrator-llm/fixtures"


def load_signal_dims():
    """text -> dimension, across every authored pool (clean + adversarial)."""
    m = {}
    for name in ("persona-signals.json", "persona-signals-adversarial.json"):
        p = FIXTURES / name
        if not p.is_file():
            continue
        blob = json.loads(p.read_text())
        for key in ("train", "test", "signals", "pool", "adversarial"):
            pool = blob.get(key)
            if isinstance(pool, list):
                for s in pool:
                    if isinstance(s, dict) and "s" in s and "d" in s:
                        m[s["s"]] = s["d"]
    return m


def dominant_dim(signals, sigdims):
    """The dimension most of a row's signals point at.

    Returns (dim, 'unique') or (None, 'tie'/'untagged'). Ties are never broken silently — a
    forced tiebreak would invent a diagonal that the data does not contain.
    """
    dims = [sigdims[s] for s in signals if s in sigdims]
    if not dims:
        return None, "untagged"
    c = collections.Counter(dims).most_common()
    if len(c) > 1 and c[0][1] == c[1][1]:
        return None, "tie"
    return c[0][0], "unique"


def entropy_bits(counter, universe=DIMS):
    total = sum(counter.get(k, 0) for k in universe)
    if not total:
        return 0.0
    h = 0.0
    for k in universe:
        p = counter.get(k, 0) / total
        if p > 0:
            h -= p * math.log2(p)
    return h


def analyse(rows, sigdims):
    xtab = {d: collections.Counter() for d in DIMS}
    top_marginal = collections.Counter()
    skipped = collections.Counter()
    appears = {d: [0, 0] for d in DIMS}  # dim -> [rows where it appears, of which it is top]

    for r in rows:
        label = json.loads(r["messages"][2]["content"])
        w = label.get("weights") or {}
        try:
            top = max(DIMS, key=lambda d: float(w[d]))
        except (KeyError, TypeError, ValueError):
            skipped["unusable-weights"] += 1
            continue
        top_marginal[top] += 1

        signals = r["meta"]["signals"]
        for d in {sigdims[s] for s in signals if s in sigdims}:
            appears[d][0] += 1
            if top == d:
                appears[d][1] += 1

        dom, why = dominant_dim(signals, sigdims)
        if dom is None:
            skipped[why] += 1
            continue
        xtab[dom][top] += 1

    return xtab, top_marginal, skipped, appears


def print_report(name, rows, sigdims):
    xtab, marg, skipped, appears = analyse(rows, sigdims)
    n = sum(marg.values())
    print(f"### {name} — {len(rows)} rows ({n} with usable weights)\n")

    if not any(sum(xtab[d].values()) for d in DIMS):
        # The adversarial pool is deliberately untagged plain strings, so there is no input
        # dimension to cross-tabulate against. The marginal still is meaningful and is the
        # part that shows label degeneracy, so report that and say plainly why the rest is
        # absent rather than printing an empty grid.
        h = entropy_bits(marg)
        ss = sum((marg[d] / n) ** 2 for d in DIMS) if n else 0.0
        print("No cross-tab: none of this split's signals carry `d` tags (the adversarial pool "
              "is deliberately untagged free text). Marginal statistics still apply.\n")
        if n:
            print("- top-dimension marginal: " +
                  ", ".join(f"`{d}` {100 * marg[d] / n:.1f}%" for d in DIMS))
        print(f"- **top-dimension entropy: {h:.3f} bits** of a possible {math.log2(len(DIMS)):.3f}")
        print(f"- **chance agreement: {ss:.3f}**\n")
        return h, {}

    print("Cross-tab: dominant INPUT signal dimension (row) vs teacher's argmax WEIGHT (column).")
    print("Cells are row percentages; the diagonal is what a teacher reading its input would fill.\n")
    header = "| input \\\\ label | " + " | ".join(DIMS) + " | row n |"
    print(header)
    print("|" + "---|" * (len(DIMS) + 2))
    diagonals = {}
    for d in DIMS:
        row = xtab[d]
        rn = sum(row.values())
        cells = []
        for c in DIMS:
            pctv = 100 * row[c] / rn if rn else 0.0
            mark = "**" if c == d else ""
            cells.append(f"{mark}{pctv:.0f}%{mark}" if rn else "—")
        if rn:
            diagonals[d] = 100 * row[d] / rn
        print(f"| {d} | " + " | ".join(cells) + f" | {rn} |")

    print()
    h = entropy_bits(marg)
    ss = sum((marg[d] / n) ** 2 for d in DIMS) if n else 0.0
    print(f"- top-dimension marginal: " +
          ", ".join(f"`{d}` {100 * marg[d] / n:.1f}%" for d in DIMS if n) if n else "")
    print(f"- **top-dimension entropy: {h:.3f} bits** of a possible {math.log2(len(DIMS)):.3f}")
    print(f"- **chance agreement (sum of squares of the marginal): {ss:.3f}** — two independent "
          f"draws from this marginal agree {100 * ss:.1f}% of the time")
    if diagonals:
        lo = min(diagonals.items(), key=lambda kv: kv[1])
        hi = max(diagonals.items(), key=lambda kv: kv[1])
        print(f"- diagonal: min {lo[1]:.0f}% (`{lo[0]}`), max {hi[1]:.0f}% (`{hi[0]}`)")
    print(f"- signal-present view (row mentions dimension X at all → X is the label's top):")
    for d in DIMS:
        tot, hit = appears[d]
        print(f"    - `{d}`: {hit}/{tot} = {100 * hit / tot:.1f}%" if tot else f"    - `{d}`: n/a")
    if skipped:
        print(f"- excluded from the cross-tab: {dict(skipped)} "
              f"(ties are never broken silently — see `dominant_dim`)")
    print()
    return h, diagonals


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--split", default="all")
    ap.add_argument("--gate", action="store_true", help="exit non-zero unless thresholds are met")
    ap.add_argument("--min-entropy", type=float, default=1.5)
    ap.add_argument("--min-diagonal", type=float, default=35.0)
    args = ap.parse_args()

    sigdims = load_signal_dims()
    print(f"_{len(sigdims)} tagged signals loaded from fixtures._\n")

    splits = ([args.split] if args.split != "all"
              else ["train", "valid", "test", "test-adversarial"])
    failures = []
    for s in splits:
        p = Path(args.data_dir) / f"{s}.jsonl"
        if not p.is_file():
            print(f"### {s} — file not found, skipped\n")
            continue
        rows = [json.loads(l) for l in p.open()]
        if not rows:
            print(f"### {s} — empty, skipped\n")
            continue
        h, diags = print_report(s, rows, sigdims)
        if args.gate:
            if h < args.min_entropy:
                failures.append(f"{s}: entropy {h:.3f} < {args.min_entropy}")
            weak = {d: v for d, v in diags.items() if v < args.min_diagonal}
            if weak:
                failures.append(f"{s}: diagonal below {args.min_diagonal}% for " +
                                ", ".join(f"{d} ({v:.0f}%)" for d, v in weak.items()))

    if args.gate:
        print("---\n")
        if failures:
            print("**GATE FAILED**")
            for f in failures:
                print(f"- {f}")
            raise SystemExit(1)
        print(f"**GATE PASSED** — entropy >= {args.min_entropy} bits and every diagonal "
              f">= {args.min_diagonal}%.")


if __name__ == "__main__":
    main()
