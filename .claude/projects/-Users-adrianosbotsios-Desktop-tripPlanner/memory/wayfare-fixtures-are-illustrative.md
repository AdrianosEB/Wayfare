---
name: wayfare-fixtures-are-illustrative
description: Wayfare docs/fixtures are illustrative/abbreviated, not byte-exact golden output
metadata:
  type: project
---

The Wayfare `docs/fixtures/` files are **illustrative**, not byte-exact targets:

- `trip-complete.json` shows only days 1 and 5 (of 8); its itinerary listing prices do NOT
  sum to its budget lines (flights line €620 but the two shown flight listings are €155 each;
  activities line €414 but only a €110 boat is shown). The budget lines DO sum to the total
  (620+96+980+414+300 = 2410). So the listings shown are samples; the budget is the invariant.
- `refine-complete.json` and the `complete` event in `sse-stream.example.txt` are abbreviated
  by their own notes (changed slice only); the real `complete.trip` is the FULL Trip.

**How to apply:** conform to the fixtures **byte-for-SHAPE** (same fields/nesting), enforced by
Zod `.strict()` schemas in `@wayfare/shared`. Enforce the real invariant in code+tests:
`budget.total === sum(lines)` and `compute_budget` as the only summer. Do NOT try to make the
LLM/planner reproduce exact fixture ids/prices. See [[wayfare-planner-dual-path]].
