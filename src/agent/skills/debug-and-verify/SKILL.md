---
name: debug-and-verify
description: Investigate a reproducible bug, make a focused repair and verify it with actual runtime or test feedback.
---
# Debug and verify

Use for a failing test, runtime error, regression or a request to validate behavior.

1. Establish the expected behavior and reproduce the actual failure. Read project instructions and relevant code. Record the error, inputs and environment; do not infer a cause from the symptom alone.
2. Localize with find/search, then read the relevant file ranges. Form one concrete hypothesis. Use shell, fetch or websocket to obtain evidence appropriate to the failing boundary.
3. Make the smallest repair that addresses the observed cause. Preserve unrelated work and existing public contracts. Add a regression test when it captures a meaningful failure, rather than mirroring the implementation.
4. Run the original failing scenario and relevant checks. Read stdout, stderr, exit code and response status. A tool returning successfully does not mean its command or HTTP request succeeded.
5. If the repair fails, use the new evidence to revise the hypothesis. Do not repeat the same unsuccessful action without changed inputs or a reason. Distinguish a code defect from a missing endpoint, dependency, credential or OS facility.
6. Inspect the diff and report the verified outcome, checks actually run and remaining uncertainty. Fixtures demonstrate the contract, not the real provider; a simulated terminal event does not prove physical mouse or OS drag-and-drop behavior.

Completion: the original failure is resolved in its tested environment, or a specific blocker is reported with reproducible evidence.
