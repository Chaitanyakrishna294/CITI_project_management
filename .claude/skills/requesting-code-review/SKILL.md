---
name: requesting-code-review
description: Use when a non-trivial change (new feature, refactor, security-sensitive logic) in this repo is otherwise ready to ship and would benefit from a second pass before merging. Triggers on "is this ready", "should I merge this", or completing a sizable diff.
---

# Requesting Code Review

Before considering larger or higher-risk changes finished, get an independent review rather than self-certifying.

## When to invoke

- Security-sensitive logic (auth, permissions, data access, AWS IAM/policy changes).
- Non-trivial backend logic or schema changes (per CLAUDE.md, this tier belongs to Opus/high-effort review).
- Larger refactors touching multiple files or shared modules.
- Skip for small, mechanical, or low-risk changes (docs, formatting, single-line fixes).

## Workflow

1. **Summarize the change** in a few sentences: what it does and why, not a line-by-line diff narration.
2. **Point at the diff**, not just a description — the reviewer needs to see the actual code, not a paraphrase of it.
3. **Flag your own uncertainty.** Call out spots you're least confident about (a tricky SQL migration, an edge case in auth logic) so review time is spent there first.
4. **Ask for a real review, not just approval.** Prefer "what's wrong with this" framing over "does this look okay?" — the latter invites rubber-stamping.
5. **Treat findings as input, not a verdict.** Fix what's actually wrong; push back (with reasoning) on suggestions that don't fit the task's actual scope.

## Anti-patterns to avoid

- Asking for review only after already merging.
- Presenting the change in a way that steers the reviewer toward agreement (e.g. "this all looks fine, right?").
- Treating all review feedback as mandatory regardless of relevance to the task at hand.
