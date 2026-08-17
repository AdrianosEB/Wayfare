#!/usr/bin/env python3
"""Rewrite an arm's eval predictions into dataset format so `diagnose_labels.py` can read them.

    ./.venv/bin/python predictions_to_jsonl.py --arm student-A --split test
    ./.venv/bin/python diagnose_labels.py --data-dir ./preds/student-A --split test

`diagnose_labels.py` measures whether a set of weight vectors is a function of its input — top-
dimension entropy, chance agreement, the signal-dimension cross-tab, the price-polarity split.
Nothing in it is specific to the teacher; it reads `messages[2].content` as "the label" and
`meta.signals` as "the input". Point it at an arm's own outputs and it answers the question that
actually sank round 1: *is this model reproducing the majority-class prior?*

Entropy on the labels says the training target is healthy. Entropy on the **predictions** says
the model learned it. Round 1 passed the first and failed the second — the labels were 0.936
bits and so was the student, and it took a separate collapse analysis to see it. This script
makes that one command instead.

Rows whose output was not schema-valid are dropped, and the count is printed: a model that emits
JSON for only a third of rows has a high-entropy *subset*, not high-entropy output, and the
denominator has to travel with the number. `meta` is copied from the source split, so signals and
the conflict flag stay attached to the row they came from.
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
          f"  ({dropped} dropped — every statistic downstream is over the {len(out)} kept)")


if __name__ == "__main__":
    main()
