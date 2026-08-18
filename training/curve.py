#!/usr/bin/env python3
"""Parse train.log into the validation-loss curve for HUMAN GATE 2 / RESULTS.md.

Reads the log rather than re-running anything, so it works on a finished run, a running one,
or an archived crashed one (training/_diverged-20260815/train.log).

    ./.venv/bin/python curve.py [--log train.log] [--patience 4]

`--patience` is the early-stop window in *evaluations*, not iterations: how many consecutive
evals may pass with no new best before the curve counts as plateaued. This run's curve twice
looked flat and then dropped again (iter 250 rose 0.013, iter 400 gained only 0.003, and both
were followed by new bests), so a 2-eval window would have stopped it early. 4 is the window
that survives the noise actually observed here.
"""

import argparse
import re

VAL = re.compile(r"^Iter (\d+): Val loss ([\d.]+|nan)", re.M)
TRAIN = re.compile(r"^Iter (\d+): Train loss ([\d.]+|nan)", re.M)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", default="train.log")
    ap.add_argument("--patience", type=int, default=4)
    args = ap.parse_args()

    text = open(args.log).read()
    vals = [(int(i), float(v) if v != "nan" else float("nan")) for i, v in VAL.findall(text)]
    nan_iters = [int(i) for i, v in TRAIN.findall(text) if v == "nan"]

    if not vals:
        print(f"{args.log}: no validation points found")
        return

    print(f"{'iter':>6}  {'val loss':>9}  {'Δ':>8}  note")
    best_v, best_i, prev = float("inf"), None, None
    for i, v in vals:
        d = "" if prev is None else f"{v - prev:+.3f}"
        note = ""
        if v < best_v:
            best_v, best_i, note = v, i, "best"
        print(f"{i:>6}  {v:>9.3f}  {d:>8}  {note}")
        prev = v

    print()
    if nan_iters:
        print(f"DIVERGED: train loss NaN from iter {nan_iters[0]} "
              f"({len(nan_iters)} NaN readings) — checkpoints at or after this iter are poisoned")

    since = sum(1 for i, _ in vals if i > best_i)
    print(f"best: {best_v:.3f} at iter {best_i}")
    print(f"evals since best: {since} (patience {args.patience})")
    if since >= args.patience:
        print(f"PLATEAUED — recommend fusing iter {best_i}: CKPT={best_i} ./fuse.sh")
    else:
        print(f"still improving or unresolved — {args.patience - since} more flat eval(s) "
              f"would confirm a plateau")


if __name__ == "__main__":
    main()
