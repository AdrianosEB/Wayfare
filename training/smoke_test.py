#!/usr/bin/env python3
"""One-prompt smoke test for HUMAN GATE 2: does the model emit schema-valid PersonaSchema JSON?

This is a gate check, not an evaluation — it asks "is the thing wired up and emitting the right
shape", not "is it any good". Quality measurement is Phase 4 (eval.py) over the held-out splits.

The validator mirrors the Zod schemas by hand (PersonaSchema in packages/orchestrator/src/types.ts,
PreferencesSchema in packages/shared/src/trip.ts). Both are `.strict()`, so unknown keys are a
failure, not a warning — a Python check that silently tolerated extra keys would pass models the
real pipeline rejects.

Usage:
    ./.venv/bin/python smoke_test.py                      # ./fused, first row of test.jsonl
    ./.venv/bin/python smoke_test.py --model ./fused --row 3
    ./.venv/bin/python smoke_test.py --model mlx-community/Qwen2.5-1.5B-Instruct-4bit
"""

import argparse
import json
import sys

PACE_VALUES = {"relaxed", "moderate", "packed"}
WEIGHT_KEYS = {"price", "quality", "location", "vibe", "flexibility"}


def validate_persona(obj):
    """Return a list of schema violations; empty list means valid.

    Mirrors PersonaSchema/PreferencesSchema including their .strict() unknown-key rejection.
    """
    errs = []
    if not isinstance(obj, dict):
        return [f"top level is {type(obj).__name__}, expected object"]

    unknown = set(obj) - {"reasoning", "weights", "preferences", "summary"}
    if unknown:
        errs.append(f"unknown top-level keys (schema is strict): {sorted(unknown)}")

    # `reasoning` precedes `weights` in PersonaSchema and is required: an array of plain strings
    # ("waves off the bill talk -> price down").
    r = obj.get("reasoning")
    if r is None:
        errs.append("missing `reasoning`")
    else:
        errs += _str_array(r, "reasoning")

    # --- weights -----------------------------------------------------------
    w = obj.get("weights")
    if w is None:
        errs.append("missing `weights`")
    elif not isinstance(w, dict):
        errs.append(f"`weights` is {type(w).__name__}, expected object")
    else:
        for k in sorted(WEIGHT_KEYS - set(w)):
            errs.append(f"`weights.{k}` missing")
        for k in sorted(set(w) - WEIGHT_KEYS):
            errs.append(f"`weights.{k}` unknown (schema is strict)")
        for k in sorted(WEIGHT_KEYS & set(w)):
            v = w[k]
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                errs.append(f"`weights.{k}` is {type(v).__name__}, expected number")
            elif v < 0:
                errs.append(f"`weights.{k}` is {v}, expected >= 0")

    # --- preferences -------------------------------------------------------
    p = obj.get("preferences")
    if p is None:
        errs.append("missing `preferences`")
    elif isinstance(p, str):
        # The teacher's own 0.5% failure mode (RESULTS.md measurement note 1). Called out by
        # name so a student inheriting it is visible here, not just in the Phase 4 tables.
        errs.append("`preferences` is a JSON string, expected a nested object (teacher's known failure mode)")
    elif not isinstance(p, dict):
        errs.append(f"`preferences` is {type(p).__name__}, expected object")
    else:
        known = {"pace", "interests", "lodgingStyle", "flightPrefs", "dietary"}
        for k in sorted(set(p) - known):
            errs.append(f"`preferences.{k}` unknown (schema is strict)")
        if "preferences" in p or "weights" in p:
            errs.append("`preferences` appears nested one level too deep (teacher's known failure mode)")

        if "pace" not in p:
            errs.append("`preferences.pace` missing (required)")
        elif p["pace"] not in PACE_VALUES:
            errs.append(f"`preferences.pace` is {p['pace']!r}, expected one of {sorted(PACE_VALUES)}")

        if "interests" not in p:
            errs.append("`preferences.interests` missing (required)")
        else:
            errs += _str_array(p["interests"], "preferences.interests")

        for opt in ("lodgingStyle", "dietary"):
            if opt in p:
                errs += _str_array(p[opt], f"preferences.{opt}")

        fp = p.get("flightPrefs")
        if fp is not None:
            if not isinstance(fp, dict):
                errs.append(f"`preferences.flightPrefs` is {type(fp).__name__}, expected object")
            else:
                for k in sorted(set(fp) - {"maxStops", "preferredTimes"}):
                    errs.append(f"`preferences.flightPrefs.{k}` unknown (schema is strict)")
                if "maxStops" in fp:
                    ms = fp["maxStops"]
                    if isinstance(ms, bool) or not isinstance(ms, int):
                        errs.append(f"`flightPrefs.maxStops` is {type(ms).__name__}, expected integer")
                    elif ms < 0:
                        errs.append(f"`flightPrefs.maxStops` is {ms}, expected >= 0")
                if "preferredTimes" in fp:
                    errs += _str_array(fp["preferredTimes"], "flightPrefs.preferredTimes")

    # --- summary -----------------------------------------------------------
    s = obj.get("summary")
    if s is None:
        errs.append("missing `summary`")
    elif not isinstance(s, str):
        errs.append(f"`summary` is {type(s).__name__}, expected string")

    return errs


def _str_array(v, label):
    if not isinstance(v, list):
        return [f"`{label}` is {type(v).__name__}, expected array"]
    return [f"`{label}[{i}]` is {type(x).__name__}, expected string"
            for i, x in enumerate(v) if not isinstance(x, str)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="./fused")
    ap.add_argument("--data", default="./data/test.jsonl", help="held-out split; row is unseen in training")
    ap.add_argument("--row", type=int, default=0)
    ap.add_argument("--max-tokens", type=int, default=1200)
    args = ap.parse_args()

    with open(args.data) as f:
        rows = [json.loads(l) for l in f]
    row = rows[args.row]
    msgs = row["messages"]
    system, user, teacher = msgs[0]["content"], msgs[1]["content"], msgs[2]["content"]

    from mlx_lm import load, generate

    print(f"model: {args.model}\nprompt: {args.data} row {args.row} (held out)\n")
    print(f"--- INPUT ---\n{user}\n")

    model, tokenizer = load(args.model)
    prompt = tokenizer.apply_chat_template(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        add_generation_prompt=True,
        tokenize=False,
    )
    out = generate(model, tokenizer, prompt=prompt, max_tokens=args.max_tokens, verbose=False)

    print(f"--- RAW OUTPUT ({len(out)} chars) ---\n{out}\n")

    try:
        parsed = json.loads(out)
    except json.JSONDecodeError as e:
        # Retry on a fenced/prefixed payload — a model that wraps valid JSON in prose is a
        # different (milder) failure than one emitting malformed JSON, and the gate should
        # distinguish them rather than lumping both under "invalid".
        start, end = out.find("{"), out.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(out[start:end + 1])
                print(f"NOTE: output was not bare JSON ({e}); recovered by extracting the outermost "
                      f"{{...}}. The production path expects bare JSON — this is a real defect, "
                      f"reported as a caveat rather than a pass.\n")
            except json.JSONDecodeError as e2:
                print(f"FAIL — not valid JSON, and outermost {{...}} did not parse either: {e2}")
                sys.exit(1)
        else:
            print(f"FAIL — not valid JSON and no {{...}} found: {e}")
            sys.exit(1)

    errs = validate_persona(parsed)
    print("--- TEACHER LABEL (same input, for eyeball comparison only) ---")
    print(teacher[:400] + ("..." if len(teacher) > 400 else "") + "\n")

    if errs:
        print(f"FAIL — {len(errs)} schema violation(s):")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)

    w = parsed["weights"]
    print(f"PASS — schema-valid PersonaSchema JSON.")
    print(f"  weights sum: {sum(w.values()):.3f} (schema does not enforce ~1.0; noted, not asserted)")
    print(f"  top dimension: {max(w, key=w.get)}")


if __name__ == "__main__":
    main()
