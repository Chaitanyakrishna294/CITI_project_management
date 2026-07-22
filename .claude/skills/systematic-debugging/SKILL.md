---
name: systematic-debugging
description: Use when investigating a bug, unexpected behavior, test failure, or production incident in this React/FastAPI/PostgreSQL/AWS stack. Triggers on "why is this failing", "this is broken", "debug this", stack traces, or failing CI.
---

# Systematic Debugging

Find the root cause before changing code. Resist the urge to try fixes at random.

## Workflow

1. **Reproduce first.** Get a reliable way to trigger the bug (a failing test, a curl command, a specific UI interaction) before touching source. If it can't be reproduced, say so explicitly rather than guessing.
2. **Read the actual error.** Full stack trace, full log line, exact request/response — not a paraphrase. For FastAPI, check the actual HTTP status and body; for React, check the console and network tab; for Postgres, check the query and error code.
3. **Localize before hypothesizing.** Bisect: which layer is at fault — frontend, API, DB, AWS resource (S3/RDS/Lambda/etc.)? Add logging or breakpoints to narrow it down rather than guessing across the whole stack.
4. **Form one hypothesis at a time** based on evidence gathered, not a list of possible causes tried in bulk.
5. **Test the hypothesis** with the smallest possible change or query (e.g. a raw SQL query in psql, a curl call bypassing the frontend) before editing application code.
6. **Fix the root cause**, not the symptom. If a bandage fix is genuinely the right call (e.g. urgent prod issue), say so explicitly and note the follow-up needed.
7. **Verify the fix** against the original reproduction, then run the broader test suite to confirm no regression.

## Anti-patterns to avoid

- Changing multiple things at once "to see what sticks."
- Adding try/except or optional-chaining to silence an error without understanding why it occurred.
- Declaring victory because the specific symptom disappeared, without confirming the underlying cause was addressed.
