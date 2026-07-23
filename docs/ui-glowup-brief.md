# UI Glow-Up Brief — HEX Project Management Platform

> **How to use:** paste this entire document into a Claude session that has the 21st.dev plugin connected and (ideally) this repository open. It is self-contained. If the session has the repo, follow §7–§9 to implement; if it only has 21st.dev, deliver §6 as designs/components and hand them back.

---

## 1. What this is

A role-based internal management platform (Material UI, React) covering project management (projects, deliverables, resources, budgets, reports) and team management (individuals, teams, achievements, team-insights dashboard). Five roles: `admin`, `project_manager`, `team_member`, `finance`, `viewer`. Desktop-first, tablet/mobile required, WCAG AA.

**Goal of this brief:** a visual and UX glow-up of the existing screens — not a rebuild, not a re-architecture. Keep the information architecture, keep the data, keep every existing interaction guarantee (see §5). Improve how it *looks* and close the specific UX gaps listed in §4.

---

## 2. Design direction — read this before generating anything

Target aesthetic: **institutional, credible, financial-services-grade** — the register of Hex, Stripe Dashboard, Linear, or Mercury. Not a startup landing page. Not a dashboard template.

**Do:**
- Deep navy / slate palette, generous whitespace, flat surfaces, hairline borders instead of shadows for structure
- Typography-led hierarchy (weight and size changes) over decoration
- One consistent line-icon set at a single stroke weight (not default Material icons used ad hoc)
- Restraint: every color, shadow, and animation must justify its presence functionally

**Don't (the specific "AI-slop" tells to avoid):**
- Gradient backgrounds, glassmorphism, glowing borders, or neon accents
- Oversized rounded blob illustrations or generic "3D render" hero icons
- Default/unmodified Material or Font-Awesome icon sets mixed inconsistently
- Purple-to-blue gradients on buttons or cards (the most common generated-SaaS tell)
- Cards with heavy drop shadows and 16px+ radius trying to look "friendly"
- Emoji used as UI iconography
- Marketing-style copy inside a working tool ("Supercharge your workflow!")

If a proposed pattern would look at home on a Dribbble "AI dashboard concept" shot rather than in a bank's internal ops tool, don't use it.

---

## 3. Existing design system — keep or evolve deliberately

Source of truth today: `frontend/src/theme.js` ("Harbor Blue", adapted from the 21st.dev community theme of that name). Every token below is currently implemented and is your baseline — evolve it, don't discard it without a stated reason.

**Color tokens**

| Token | Hex | Usage |
|---|---|---|
| primary.main | #194391 | Buttons, links, active nav, focus rings (9.6:1 on white) |
| primary.light | #4169e1 | Hover/derived accents |
| primary.dark | #122f66 | Pressed states |
| secondary.main | #475569 | Neutral emphasis |
| success.main | #15803d | Positive status |
| warning.main | #b45309 | Caution status |
| error.main | #dc2626 | Errors, destructive actions |
| info.main | #0369a1 | Informational |
| background.default | #f1f5f9 | Page canvas |
| background.paper | #ffffff | Cards, tables, dialogs |
| text.primary | #0f172a | Body text |
| text.secondary | #475569 | Muted text (darkened past default to clear 4.5:1 AA) |
| divider | #e2e8f0 | Hairline borders |

Status colors (state, never series — always paired with a text label): active/completed `#15803d`, delayed `#b45309`, archived/not_started `#64748b`, in_progress `#194391`, blocked `#b91c1c`.

Chart palette (fixed order, never cycled, CVD-validated): `#2255b0`, `#15803d`, `#c2410c`, `#7c3aed`; a 5th+ series folds into "Other." Changing any of these requires re-validating contrast and color-vision-deficiency separation — the validation rationale is documented inline in theme.js.

**Type:** Inter Variable, self-hosted via `@fontsource-variable/inter`, no CDN. h4 24/600 (page headings), h6 18/600 (card/dialog headings), subtitle2 14/600 (KPI labels), body1 16/400, body2 14/400 (table cells — this is the floor, never go smaller), button 14/600 no uppercase, caption 12/400.

**Space/shape:** strict 8px grid (`theme.spacing(1)` = 8px), 8px radius everywhere, flat elevation (dialogs are the only shadowed surface), `2px solid #194391` focus outline with 2px offset on every interactive element.

You may propose token changes (e.g., a refined radius scale, a differentiated link treatment) but state each change and the reason — don't silently drift from this system.

---

## 4. Specific glow-up targets (from a completed design critique)

Fix these — they're the gap between "functional" and "premium," in priority order:

1. **Mobile table treatment (the one real UX break).** Tables currently just scroll horizontally on small screens, losing the identifying first column. Design and implement a card-list transform for data tables below the `md` breakpoint (each row becomes a stacked label:value card), or at minimum a sticky first column. This applies to the shared `DataTable` component so every screen inherits it.
2. **Icon system.** Replace ad hoc default Material icons with one consistent line-icon set at a single stroke width matching Inter's weight (Phosphor, Untitled UI Icons, Lucide, or similar — must be license-compatible). Apply consistently: nav, buttons, empty states, dialogs. Highest visual ROI for looking intentional vs. generated.
3. **Navigation grouping.** Currently 10 flat items. Group into sections — Work (Dashboard, Projects, Deliverables, Resources, Budgets, Reports) / Teams (Teams, Individuals, Team Insights) / Admin (Users) — with small caption-weight, letter-spaced section labels. Keep role-gating per item exactly as it is.
4. **Dashboard hierarchy.** Currently a uniform KPI grid with no priority signal. Add an "attention" tier — at-risk projects, over-allocated resources — visually distinct and above the steady-state KPIs, not mixed in equally.
5. **Page identity.** Every list screen opens with an identical h4-plus-button header. Add a contextual count/summary under the heading (e.g., "Projects · 24 active · 3 at risk") so screens are distinguishable by more than title text.
6. **Empty states.** Currently one generic inbox icon everywhere. Design 2–3 purpose-built line illustrations (matching the icon set's stroke weight), reused across related screens.
7. **Link vs. button weight.** `primary.main` carries buttons, links, active nav, and focus rings all at once — on dense screens everything blue competes equally. Differentiate link treatment (underline-on-hover, no fill) from button treatment (filled, no underline).

---

## 5. Non-negotiable constraints — do not break these

The existing UX contracts must survive the glow-up untouched in behavior, even as visuals change:

- Material UI component library — restyle via theme and `sx`, don't fork/replace MUI components with another library
- Every list keeps sort, pagination, CSV export (via the shared `DataTable`), plus any screen-level search/filter toolbar it has today
- Every create/edit form keeps: inline validation, submit disabled while in flight with a relabel ("Adding…"), inline `Alert` error at top of the dialog which stays open on failure, success `Snackbar` naming the object, 4s auto-hide
- Destructive actions keep the `ConfirmDialog` pattern: specific title ("Deactivate Ada Admin?"), one-sentence consequence, error-colored confirm button — never native `confirm()`
- All four data-screen states remain: loading (skeleton, `role="status"`), error (with retry), empty (with CTA), loaded
- AA contrast on all text, visible `:focus-visible` outline on every interactive element, status conveyed by label + color together (never color alone), icon-only buttons keep `aria-label`s
- Role-gating of nav items and write actions stays exactly as specified
- No hardcoded hex in screen code — theme tokens only
- Numeric values from the API arrive as strings (Postgres NUMERIC) — keep the `Number()` wrapping wherever it exists

---

## 6. What to deliver

For each of the following, produce updated designs and working MUI component code (use the 21st.dev plugin to search for reference patterns — translate references into this MUI token system, don't install shadcn/Tailwind components into this MUI app):

1. App shell — top bar + grouped, sectioned navigation drawer (desktop + mobile hamburger state)
2. List screen archetype (Projects) — desktop table view AND the mobile card-list fallback in `DataTable`
3. Details screen archetype (Team details) — two-column desktop, stacked mobile
4. KPI dashboard archetype — with the new attention/steady-state tiering
5. One create/edit dialog and one destructive confirm dialog, restyled with the new icon set
6. One empty state using a purpose-built illustration
7. A one-page icon and component style sheet documenting the icon set, button/link distinction, and any token additions — add it to `docs/ui-ux-engineer.md`

For each screen, briefly note *why* each change was made (tie back to §4) so the rationale travels with the design.

---

## 7. Repository context (for sessions with the repo open)

Repo root: `/home/1695f566/HEX`. Frontend: `frontend/` (Vite + React + MUI). Read `CLAUDE.md` at the repo root first — it carries binding conventions.

Key files:

| What | Where |
|---|---|
| Theme (all tokens) | `frontend/src/theme.js` |
| App shell / nav | `frontend/src/components/AppLayout.jsx` |
| Shared table | `frontend/src/components/DataTable.jsx` |
| Loading/empty/error states | `frontend/src/components/PageState.jsx` |
| Destructive confirm | `frontend/src/components/ConfirmDialog.jsx` |
| Charts | `frontend/src/components/charts/` |
| All screens | `frontend/src/pages/*.jsx` (each has a co-located `.test.jsx`) |
| Routes | `frontend/src/App.jsx` |
| Current design documentation | `docs/ui-ux-engineer.md` |
| Underlying UX spec | `req/UI_UX_Design&UserFlow.md`, `req/Application_Flow.md` |

Conventions that will bite you if ignored:
- `react-hooks/set-state-in-effect` lint rule: data screens derive `loading` from a request key instead of setting state synchronously in effects — follow the existing pattern in `pages/Projects.jsx`
- Component tests query by accessible role/name — if you change a button label or dialog title, update its test
- Work on a feature branch; do not commit to `main`

## 8. Verification (must pass before you're done)

```bash
cd frontend && npm run lint    # must stay at zero errors
cd frontend && npm test        # full Vitest suite must pass (287+ tests)
```

Visual verification: the dev stack runs Vite on port 3000 with a LocalStack backend already up. Log in with `admin@hex.com` / `Workshop123!`. If the running backend is unavailable, start a second Vite against a mock API instead (`VITE_API_URL=http://localhost:<mock-port> npm run dev -- --port 3002 --strictPort`) rather than touching `frontend/.env.local`, which the port-3000 server watches.

## 9. Working method

1. Read `CLAUDE.md`, `docs/ui-ux-engineer.md`, `theme.js`, `AppLayout.jsx`, and `DataTable.jsx` before designing.
2. Use 21st.dev search for reference patterns per deliverable; translate into MUI + Harbor Blue tokens.
3. Implement in this order: icon set foundation → DataTable mobile fallback → nav grouping → dashboard tiering → page headers → dialogs/empty states → style sheet.
4. Run lint + tests after each numbered step, not just at the end.
5. Update `docs/ui-ux-engineer.md` §2–§4 to reflect any token or pattern changes you make, and append the §6.7 style sheet to it.
