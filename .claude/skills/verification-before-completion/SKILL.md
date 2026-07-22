---
name: verification-before-completion
description: Use before reporting any coding task as done in this repo — after implementing a feature, fixing a bug, or refactoring. Triggers before saying "done", "fixed", "implemented", or handing work back to the user.
---

# Verification Before Completion

Don't report a task as complete until you've actually checked it, not just written code that looks right.

## Checklist before declaring done

1. **Run it.** For backend (FastAPI) changes, actually call the endpoint (test client or curl) and check the response. For frontend (React) changes, start the dev server and exercise the feature in a browser — don't rely on the code reading correctly.
2. **Run the existing test suite**, not just any new tests you wrote. A green new test next to a broken old one is not done.
3. **Check the golden path and at least one edge case** (empty input, error response, auth failure) — not just the happy path the user described.
4. **Re-read your diff** for leftover debug statements, commented-out code, or unrelated changes.
5. **Match the claim to the evidence.** If you couldn't actually run something (e.g. no way to hit AWS locally), say so explicitly instead of asserting it works.

## Anti-patterns to avoid

- Saying "this should work" instead of demonstrating that it does.
- Treating type-checking or linting passing as equivalent to the feature working.
- Reporting success based on reading the code a second time rather than executing it.
