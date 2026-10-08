---
name: reliability-audit
description: Audit the implementation for calculation, data-flow, state, fallback and regression reliability problems. Reports; fixing is a separate task.
---
Read docs/PROJECT.md for what the product is, who the customer is, and the goal. If the customer is not named there, ask before starting. Tag every point observed (anyone could verify it) or opinion (your judgment). Return text only; the main session writes files.

# Reliability audit
Investigate the current implementation. Do not change anything in an analysis task.
Check:
- unit conversion and period conversion
- duplicated calculations
- fallback paths that contaminate results
- stale or duplicated state
- provenance errors
- extraction vs assembly mismatches
- incomplete-input and blocked behavior
- race conditions and error handling
- regression test coverage
- debug or internal values visible in the UI
For every defect report: how to reproduce it, the root cause, the affected paths, the smallest safe fix, and the test that would cover it. The fix itself is a separate BUILD task.
