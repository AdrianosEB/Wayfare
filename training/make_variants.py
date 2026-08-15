#!/usr/bin/env python3
"""Build the two training targets from one teacher pass, and measure the per-field token share.

    ./.venv/bin/python make_variants.py --src ./data --out-a ./data-A --out-b ./data-B

The labels are fixed by the teacher; the *training target* is a separate choice, and it is the
second root cause. `summary` is prose the ranker never reads, and it dominates the label by
token count — so under a token-level cross-entropy loss the weights, which are the only part
anything downstream consumes, receive a small fraction of the gradient. A student can drive the
loss down convincingly by learning to write like a travel consultant while leaving the weights
at their marginal distribution, which is exactly what the first one did.

  A — full label:      reasoning, weights, preferences, summary
  B — summary removed: reasoning, weights, preferences

Training both on identical labels isolates that effect from the label-quality fix, which is why
the two causes were kept in separate commits.

Token counts come from the actual base-model tokenizer, not a character heuristic: the share is
the whole point of the exercise and an approximation would undercut the conclusion.
"""

import argparse
import json
from pathlib import Path

FIELDS = ["reasoning", "weights", "preferences", "summary"]


def field_token_share(rows, tok):
    """Median share of assistant-label tokens spent on each field.

    Fields are measured as the tokens of their serialized `"key": value` fragment, so the shares
    are comparable to each other and sum to slightly under the whole (punctuation and braces are
    not attributed to any field).
    """
    totals = {f: [] for f in FIELDS}
    whole = []
    for r in rows:
        content = r["messages"][2]["content"]
        obj = json.loads(content)
        n_all = len(tok.encode(content))
        whole.append(n_all)
        for f in FIELDS:
            if f in obj:
                frag = json.dumps({f: obj[f]})[1:-1]  # strip the wrapping braces
                totals[f].append(len(tok.encode(frag)) / n_all if n_all else 0.0)
    import statistics
    return ({f: (100 * statistics.median(v) if v else 0.0) for f, v in totals.items()},
            statistics.median(whole) if whole else 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="./data")
    ap.add_argument("--out-a", default="./data-A")
    ap.add_argument("--out-b", default="./data-B")
    ap.add_argument("--model", default="mlx-community/Qwen2.5-1.5B-Instruct-4bit")
    ap.add_argument("--splits", default="train,valid,test,test-adversarial")
    args = ap.parse_args()

    from mlx_lm.tokenizer_utils import load_tokenizer
    from mlx_lm.utils import get_model_path
    tok = load_tokenizer(get_model_path(args.model)[0])

    Path(args.out_a).mkdir(exist_ok=True)
    Path(args.out_b).mkdir(exist_ok=True)

    for split in args.splits.split(","):
        src = Path(args.src) / f"{split}.jsonl"
        if not src.is_file():
            print(f"{split}: not found, skipped")
            continue
        rows = [json.loads(l) for l in src.open()]

        a_lines, b_lines = [], []
        for r in rows:
            obj = json.loads(r["messages"][2]["content"])
            a_lines.append(json.dumps(r))
            stripped = {k: v for k, v in obj.items() if k != "summary"}
            b = {
                "messages": [r["messages"][0], r["messages"][1],
                             {"role": "assistant", "content": json.dumps(stripped)}],
                "meta": r["meta"],
            }
            b_lines.append(json.dumps(b))

        (Path(args.out_a) / f"{split}.jsonl").write_text("\n".join(a_lines) + "\n")
        (Path(args.out_b) / f"{split}.jsonl").write_text("\n".join(b_lines) + "\n")

        shares_a, med_a = field_token_share(rows, tok)
        shares_b, med_b = field_token_share([json.loads(l) for l in b_lines], tok)
        print(f"\n### {split} — {len(rows)} rows")
        print(f"| field | share of label tokens, A | share, B |")
        print(f"|---|---|---|")
        for f in FIELDS:
            print(f"| {f} | {shares_a[f]:.1f}% | {shares_b[f]:.1f}% |")
        print(f"median label length: A {med_a} tokens · B {med_b} tokens "
              f"({100 * (1 - med_b / med_a):.0f}% shorter)" if med_a else "")


if __name__ == "__main__":
    main()
