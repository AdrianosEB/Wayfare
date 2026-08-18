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

WHY THE DIAGONAL GATE EXCLUDES `flexibility` — do not re-add it
---------------------------------------------------------------
`flexibility` is not a scoring axis. In `packages/orchestrator/src/agents/match.ts` the ranked
score is `price + quality + location + vibe + verification`; the flexibility weight appears
nowhere in it except as a multiplier folded into price:

    const priceWeight = w.price + w.flexibility * 0.5;

So a "flexibility-top" label is not a meaningful target. A persona with flexibility 0.40 and
price 0.15 yields an effective price weight of 0.35 — gating on a flexibility diagonal would
manufacture price-led rankings, which is the exact bias this diagnostic exists to detect. The
diagonal is therefore checked only for the four dimensions the ranker actually scores, while
the cross-tab still *displays* flexibility so the asymmetry stays visible.

This is a deliberate decision recorded in training/RESULTS.md, not an oversight. Whether a
five-dimension PersonaWeights is the right shape at all is a separate open question; it is not
resolved by narrowing this gate.
"""

import argparse
import collections
import json
import math
import statistics
from pathlib import Path

DIMS = ["price", "quality", "location", "vibe", "flexibility"]
# The four dimensions match.ts actually scores. See the module docstring: flexibility is a
# multiplier on price, not an axis, so its diagonal is displayed but never gated.
SCORED_DIMS = ["price", "quality", "location", "vibe"]
# Gated subset. `vibe` is reported but does not block: at the gate sample size (n~25 rows in
# its cross-tab row) the bar carries roughly +/-19pp, and it read 31%, 48%, 32% across three
# rounds of otherwise-improving labels. That is noise, and blocking on it costs a $0.75 run to
# resolve nothing. The full pass gives n~200, where it is actually measurable.
GATED_DIMS = ["price", "quality", "location"]
REPO = Path(__file__).resolve().parent.parent
FIXTURES = REPO / "packages/orchestrator-llm/fixtures"


def load_signals():
    """text -> (dimension, polarity), across every authored pool (clean + adversarial)."""
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
                        m[s["s"]] = (s["d"], s.get("p", 0))
    return m


def load_signal_dims():
    return {k: v[0] for k, v in load_signals().items()}


def price_polarity(signals, sigs):
    """How this row's signals talk about price: frugal / freely / mixed / none.

    `none` is the interesting bucket. A teacher that reads its input should treat the absence
    of any price signal as *no information about price* — not as evidence of frugality. If the
    `none` bucket looks like the `frugal` bucket, the model is answering from a prior.
    """
    pol = [sigs[s][1] for s in signals if s in sigs and sigs[s][0] == "price"]
    if not pol:
        return "none"
    total = sum(pol)
    return "frugal" if total > 0 else "freely" if total < 0 else "mixed"


def polarity_report(rows, sigs):
    """Price-polarity split + weight-shape stats. Returns (price_top_pct_no_signal, mean_max_w)."""
    groups = collections.defaultdict(list)
    maxw, minw = [], []
    for r in rows:
        w = json.loads(r["messages"][2]["content"]).get("weights") or {}
        try:
            vals = {d: float(w[d]) for d in DIMS}
        except (KeyError, TypeError, ValueError):
            continue
        total = sum(vals.values()) or 1.0
        nvals = {d: v / total for d, v in vals.items()}
        maxw.append(max(nvals.values()))
        minw.append(min(nvals.values()))
        top = max(DIMS, key=lambda d: nvals[d])
        groups[price_polarity(r["meta"]["signals"], sigs)].append((nvals["price"], top))

    print("Price-polarity split — does the label move with explicit price evidence?\n")
    print("| price signal | n | mean price weight | price-top |")
    print("|---|---|---|---|")
    none_pct = frugal_pct = None
    for k in ("frugal", "mixed", "freely", "none"):
        g = groups.get(k)
        if not g:
            continue
        pt = 100 * sum(1 for _, t in g if t == "price") / len(g)
        if k == "none":
            none_pct = pt
        if k == "frugal":
            frugal_pct = pt
        print(f"| {k} | {len(g)} | {statistics.mean(x for x, _ in g):.3f} | {pt:.1f}% |")

    mean_max = statistics.mean(maxw) if maxw else 0.0
    mean_min = statistics.mean(minw) if minw else 0.0
    print(f"\n- weight shape: mean max-weight **{mean_max:.3f}**, mean min-weight {mean_min:.3f}")
    print(f"  (a fix that flattens every vector toward uniform 0.200 is not a fix — it would "
          f"raise entropy while carrying just as little information. Mean max-weight below "
          f"~0.28 means the vectors have gone flat.)")
    if none_pct is not None:
        print(f"- **no-price-signal rows are price-top {none_pct:.1f}%** — the sharpest single "
              f"test of the default-to-price prior")
    if frugal_pct is not None:
        print(f"- **explicitly frugal rows are price-top {frugal_pct:.1f}%** — the response must "
              f"stay symmetric; removing a prior must not become a reversed prior")
    print()
    return none_pct, mean_max, frugal_pct


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


def print_report(name, rows, sigdims, sigs=None):
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
        none_pct, mean_max, frugal_pct = polarity_report(rows, sigs) if sigs else (None, None, None)
        return h, {}, none_pct, mean_max, frugal_pct

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
    none_pct, mean_max, frugal_pct = polarity_report(rows, sigs) if sigs else (None, None, None)
    return h, diagonals, none_pct, mean_max, frugal_pct


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="./data")
    ap.add_argument("--split", default="all")
    ap.add_argument("--gate", action="store_true", help="exit non-zero unless thresholds are met")
    ap.add_argument("--min-entropy", type=float, default=1.5)
    ap.add_argument("--min-diagonal", type=float, default=35.0)
    ap.add_argument("--max-price-top-no-signal", type=float, default=40.0,
                    help="ceiling on price-top%% among rows with NO price signal (was 87.1%%)")
    ap.add_argument("--min-mean-max-weight", type=float, default=0.28,
                    help="floor on mean max-weight; below this the vectors have gone flat")
    ap.add_argument("--min-frugal-price-top", type=float, default=65.0,
                    help="floor on price-top%% among explicitly frugal rows; removing a prior "
                         "must not become a reversed prior")
    ap.add_argument("--max-discard-pct", type=float, default=5.0,
                    help="ceiling on the generator's discard rate, read from the split's "
                         "sidecar progress file when present (teacher baseline: 0.5%%)")
    args = ap.parse_args()

    sigs = load_signals()
    sigdims = {k: v[0] for k, v in sigs.items()}
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
        h, diags, none_pct, mean_max, frugal_pct = print_report(s, rows, sigdims, sigs)

        # Discards never reach the .jsonl, so the rate has to come from the sidecar the
        # generator writes. A pass that silently drops a fifth of its rows is not a clean pass
        # even when every row it kept looks good.
        discard_pct = None
        prog = Path(args.data_dir) / f".{s}.progress.json"
        if prog.is_file():
            st = json.loads(prog.read_text())
            attempts = st.get("written", 0) + st.get("discarded", 0)
            if attempts:
                discard_pct = 100 * st["discarded"] / attempts
                print(f"- generator discard rate: **{discard_pct:.1f}%** "
                      f"({st['discarded']} of {attempts} attempts)\n")

        if args.gate:
            if h < args.min_entropy:
                failures.append(f"{s}: entropy {h:.3f} < {args.min_entropy}")
            # Only the dimensions match.ts scores — see the module docstring on flexibility.
            weak = {d: v for d, v in diags.items() if d in GATED_DIMS and v < args.min_diagonal}
            vibe = diags.get("vibe")
            if vibe is not None:
                print(f"- vibe diagonal {vibe:.0f}% (reported, non-blocking at this sample size)")
            if weak:
                failures.append(f"{s}: diagonal below {args.min_diagonal}% for " +
                                ", ".join(f"{d} ({v:.0f}%)" for d, v in weak.items()))
            if frugal_pct is not None and frugal_pct < args.min_frugal_price_top:
                failures.append(f"{s}: explicitly frugal rows are price-top {frugal_pct:.1f}% "
                                f"< {args.min_frugal_price_top}% — overcorrected into a "
                                f"reversed prior")
            if discard_pct is not None and discard_pct >= args.max_discard_pct:
                failures.append(f"{s}: discard rate {discard_pct:.1f}% "
                                f">= {args.max_discard_pct}%")
            if none_pct is not None and none_pct >= args.max_price_top_no_signal:
                failures.append(f"{s}: no-price-signal rows are price-top {none_pct:.1f}% "
                                f">= {args.max_price_top_no_signal}% — still defaulting to price")
            # Checked even when the others pass: flattening every vector toward uniform would
            # satisfy entropy and the diagonal while destroying the signal it is meant to prove.
            if mean_max is not None and mean_max < args.min_mean_max_weight:
                failures.append(f"{s}: mean max-weight {mean_max:.3f} < "
                                f"{args.min_mean_max_weight} — vectors collapsed toward uniform")

    if args.gate:
        print("---\n")
        if failures:
            print("**GATE FAILED**")
            for f in failures:
                print(f"- {f}")
            raise SystemExit(1)
        print(f"**GATE PASSED** — entropy >= {args.min_entropy} bits; diagonal >= "
              f"{args.min_diagonal}% for {', '.join(GATED_DIMS)} (vibe reported non-blocking, flexibility excluded by "
              f"design); no-price-signal price-top < {args.max_price_top_no_signal}%; frugal "
              f"price-top >= {args.min_frugal_price_top}%; mean max-weight >= "
              f"{args.min_mean_max_weight}; discards < {args.max_discard_pct}%.")


if __name__ == "__main__":
    main()
