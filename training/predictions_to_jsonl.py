#!/usr/bin/env python3
"""Rewrite an arm's eval predictions into dataset format so `diagnose_labels.py` can read them.

    ./.venv/bin/python predictions_to_jsonl.py --arm student-A --split test
    ./.venv/bin/python diagnose_labels.py --data-dir ./preds/student-A --split test

`diagnose_labels.py` reads `messages[2].content` as the label and `meta.signals` as the input,
so pointing it at an arm's outputs shows whether the model is reproducing the majority-class
prior. In round 1 the labels and the student both had 0.936 bits of top-dimension entropy.

Rows whose output was not schema-valid are dropped and the count is printed, since the
statistics then cover only the kept subset. `meta` is copied from the source split, so signals
and the conflict flag stay attached to their row.
"""

import argparse
import json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", required=True)
    ap.add_argument("--split", default="test")
    ap.add_argument("--results-dir", default="./results")
    ap.add_argument("--data-dir", default="./data",
                    help="source split, read only for `meta` and the prompt messages")
    ap.add_argument("--out-root", default="./preds")
    args = ap.parse_args()

    res = json.loads((Path(args.results_dir) / f"{args.arm}-{args.split}.json").read_text())
    rows = {json.loads(l)["meta"]["index"]: json.loads(l)
            for l in (Path(args.data_dir) / f"{args.split}.jsonl").open()}

    out, dropped = [], 0
    for rec in res["records"]:
        if not rec["schema_valid"]:
            dropped += 1
            continue
        src = rows.get(rec["index"])
        if src is None:
            dropped += 1
            continue
        # Re-serialise through the parser eval.py used, so an output that was recovered from
        # surrounding prose is analysed as the object the scorer saw, not as raw text.
        s, e = rec["output"].find("{"), rec["output"].rfind("}")
        obj = json.loads(rec["output"][s:e + 1])
        out.append(json.dumps({
            "messages": [src["messages"][0], src["messages"][1],
                         {"role": "assistant", "content": json.dumps(obj)}],
            "meta": src["meta"],
        }))

    dest = Path(args.out_root) / args.arm
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / f"{args.split}.jsonl"
    path.write_text("\n".join(out) + "\n")
    total = len(res["records"])
    print(f"{args.arm}/{args.split}: {len(out)}/{total} schema-valid rows -> {path}"
          f"  ({dropped} dropped; every statistic downstream is over the {len(out)} kept)")


if __name__ == "__main__":
    main()
