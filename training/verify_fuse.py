#!/usr/bin/env python3
"""Prove a fused model actually has its adapters in it. Run on EVERY fuse before measuring.

    ./.venv/bin/python verify_fuse.py --fused ./fused-A --adapters ./adapters-A

`mlx_lm fuse` into a quantized base silently produces a model with the adapters *not applied* —
no error, no warning; it loads and answers as the untuned base (2026-08-15, iter-650 checkpoint;
`fuse.sh` now passes `--dequantize`). A generation smoke test catches the loud version of that
failure, where the unfused model emits prose. It does not catch the quiet version: once a base
is capable enough to emit plausible JSON on its own, "it produced JSON" stops being evidence
that anything was fused, and the arm gets measured under the student's name.

So this checks the weights directly, not the behaviour:

* **Targeted projections must differ.** For every layer the adapter touches, dequantize the base
  tensor and compare it to the fused one. `W_fused` should be `W_base + (scale/rank) * B @ A`,
  which is non-zero for a trained adapter. A max-abs delta at dequantization roundoff means the
  adapter was dropped.
* **Untouched layers are the control.** Layers below the LoRA window went through the same
  dequantization and nothing else, so their delta bounds the roundoff floor. If the targeted
  layers do not clearly exceed that floor, the difference is not the adapter.

Exit status is non-zero when the check fails, so it can gate a pipeline.
"""

import argparse
import json
import re
from pathlib import Path


def load_index(model_dir):
    """path -> {tensor name: file}, handling both single-file and sharded checkpoints."""
    d = Path(model_dir)
    idx = d / "model.safetensors.index.json"
    if idx.is_file():
        m = json.loads(idx.read_text()).get("weight_map", {})
        if m:
            return {k: d / v for k, v in m.items()}
    files = sorted(d.glob("*.safetensors"))
    if not files:
        raise SystemExit(f"verify_fuse: no .safetensors under {d}")
    from safetensors import safe_open
    out = {}
    for f in files:
        with safe_open(f, framework="numpy") as h:
            for k in h.keys():
                out[k] = f
    return out


def get(index, name):
    from safetensors import safe_open
    with safe_open(index[name], framework="numpy") as h:
        return h.get_tensor(name)


def dequantize(w, scales, biases, group_size, bits):
    """Undo MLX's affine group quantization: `bits` values packed per uint32, `group_size` per scale."""
    import numpy as np
    per_word = 32 // bits
    mask = (1 << bits) - 1
    u = w.view(np.uint32) if w.dtype != np.uint32 else w
    shifts = np.arange(per_word, dtype=np.uint32) * bits
    # (rows, packed) -> (rows, packed, per_word) -> (rows, cols)
    vals = (u[:, :, None] >> shifts[None, None, :]) & mask
    vals = vals.reshape(u.shape[0], -1).astype(np.float32)
    groups = vals.reshape(vals.shape[0], -1, group_size)
    deq = groups * scales[:, :, None].astype(np.float32) + biases[:, :, None].astype(np.float32)
    return deq.reshape(vals.shape)


def main():
    import numpy as np

    ap = argparse.ArgumentParser()
    ap.add_argument("--fused", required=True)
    ap.add_argument("--adapters", required=True)
    ap.add_argument("--base", default="mlx-community/Qwen2.5-1.5B-Instruct-4bit")
    ap.add_argument("--sample", type=int, default=6, help="targeted tensors to check")
    args = ap.parse_args()

    base_dir = args.base
    if not Path(base_dir).is_dir():
        from huggingface_hub import snapshot_download
        base_dir = snapshot_download(args.base, local_files_only=True,
                                     allow_patterns=["*.json", "*.safetensors", "*.txt", "*.jinja"])

    cfg = json.loads((Path(base_dir) / "config.json").read_text())
    q = cfg.get("quantization") or {}
    gs, bits = q.get("group_size", 64), q.get("bits", 4)

    base_ix, fused_ix = load_index(base_dir), load_index(args.fused)

    from safetensors import safe_open
    with safe_open(Path(args.adapters) / "adapters.safetensors", framework="numpy") as h:
        akeys = list(h.keys())
    touched = sorted({int(m.group(1)) for k in akeys if (m := re.search(r"layers\.(\d+)\.", k))})
    targets = sorted({re.sub(r"\.lora_[ab]$", ".weight", k) for k in akeys})
    print(f"adapter: {len(akeys)} tensors over layers {touched[0]}–{touched[-1]}")

    def delta(name):
        if name not in fused_ix or name not in base_ix:
            return None
        bw = get(base_ix, name)
        if f"{name[:-len('.weight')]}.scales" in base_ix:
            stem = name[: -len(".weight")]
            bw = dequantize(bw, get(base_ix, f"{stem}.scales"), get(base_ix, f"{stem}.biases"), gs, bits)
        fw = get(fused_ix, name).astype(np.float32)
        if fw.shape != bw.shape:
            return None
        return float(np.abs(fw - bw).max())

    # Control: layers below the LoRA window — dequantized, never adapted.
    control = []
    for layer in range(0, touched[0]):
        for proj in ("self_attn.q_proj", "mlp.up_proj"):
            d = delta(f"model.layers.{layer}.{proj}.weight")
            if d is not None:
                control.append(d)
        if len(control) >= 6:
            break
    floor = max(control) if control else 0.0
    print(f"control (layers 0–{touched[0] - 1}, dequantized only): max |Δ| = {floor:.3e} "
          f"over {len(control)} tensors — this is the roundoff floor")

    checked, failures = [], []
    for name in targets[: args.sample] + targets[-args.sample:]:
        d = delta(name)
        if d is None:
            continue
        checked.append((name, d))
        if d <= floor:
            failures.append((name, d))

    print(f"\ntargeted projections ({len(checked)} sampled):")
    for name, d in checked:
        flag = "  <-- NOT ADAPTED" if d <= floor else ""
        print(f"  {name:52} max |Δ| = {d:.3e}{flag}")

    if not checked:
        raise SystemExit("verify_fuse: FAIL — no targeted tensors could be compared")
    if failures:
        print(f"\nFAIL — {len(failures)}/{len(checked)} targeted tensors are at or below the "
              f"roundoff floor. The adapters were not applied; this model is the base.")
        raise SystemExit(1)

    ratio = min(d for _, d in checked) / floor if floor else float("inf")
    print(f"\nPASS — every sampled targeted projection differs from the base by more than the "
          f"dequantization floor (smallest is {ratio:.0f}x the floor). Adapters are fused in.")


if __name__ == "__main__":
    main()
