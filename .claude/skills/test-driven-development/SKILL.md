---
name: test-driven-development
description: Use when implementing a new feature, bug fix, or backend/frontend logic change in this repo (React, FastAPI, PostgreSQL) and a test can be written before the code. Triggers on requests to "add a feature", "fix a bug", "implement an endpoint/component" where correctness matters.
---

# Test-Driven Development

Write the test before the implementation, and let it drive the design.

## Workflow

1. **Understand the requirement.** Restate what "correct" looks like in one or two sentences before writing anything.
2. **Write a failing test first.**
   - FastAPI endpoints: a test hitting the route via the test client, asserting status code and response shape.
   - React components: a test asserting rendered output or behavior on interaction, not implementation details.
   - SQL/CRUD logic: a test against a real or test database, not a mock, asserting the actual persisted state.
3. **Run the test and confirm it fails** for the expected reason (not a typo or import error).
4. **Write the minimum code** to make the test pass. Don't add extra handling for cases the test doesn't cover.
5. **Run the full test suite**, not just the new test, to catch regressions.
6. **Refactor only after green**, keeping tests passing throughout.

## When to skip this

- Pure exploratory spikes the user has explicitly framed as throwaway.
- Trivial one-line config/markup changes with no logic.

## Anti-patterns to avoid

- Writing the implementation first and back-filling tests to match its behavior — this only proves the code does what it does, not what it should.
- Mocking out the database or external service in a test that exists to catch integration bugs.
- Skipping the "watch it fail" step — an untested test can pass for the wrong reason.
