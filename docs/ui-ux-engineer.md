# Coding Workshop - UI/UX Engineer Guide

> [Main Guide](./README.md) | [Validation Guide](./validation.md) | [Full Stack Guide](./full-stack.md) | [Data Engineer Guide](./data-engineer.md) | [System Engineer Guide](./system-engineer.md) | **UI/UX Engineer Guide**

This document captures the **current design system and screen layouts** of the CITI Project Management Platform so a UI/UX designer can audit, critique, and enhance it. Everything here reflects what is actually implemented in code today — file paths are given so every token and pattern can be traced to its source.

---

## 1. Product at a glance

A centralized, role-based management platform with two domains:

1. **Project management** — projects, deliverables, resources, budgets, reports.
2. **Team management** — individuals (org roster), teams, monthly achievements, and a structural-insights dashboard.

Audience: internal staff on desktop first, with tablet/mobile support required (WCAG-compliant, responsive). Five roles gate what users can see and do: `admin`, `project_manager`, `team_member`, `finance`, `viewer`.

---

## 2. Design language

The visual language is **"Harbor Blue"** — adapted from the 21st.dev community theme of that name and translated into Material UI tokens: deep navy primary on slate neutrals, white cards with hairline borders on a light-gray canvas, 8&nbsp;px radius, flat surfaces (no drop shadows on data screens).

The 2026-07 **v2 glow-up** added a shape layer on top of the tokens (custom silhouettes, not just custom colors): **Fraunces** as the display serif for page-level titles only (body/data/buttons stay Inter), a **solid deep-navy sidebar** with a warm off-white active plate, a **custom table treatment** (2px primary underline under headers instead of a gray wash, 3px left-edge hover bar instead of a row tint, tabular figures in numeric columns), **status dots** (rounded-square dot + label) replacing filled status pills — filled pills are reserved for counts/badges — and **sub-200ms motion** (KPI count-up, chart line/segment draw-in) that always collapses under `prefers-reduced-motion`. Tokens are mirrored as CSS custom properties in `frontend/src/index.css` (`:root` and `[data-theme="dark"]`), and one **accent** beyond navy (ochre `#b45309` light / amber `#fbbf24` dark) is reserved exclusively for "needs acting on" signals.

**Single source of truth:** [`frontend/src/theme.js`](../frontend/src/theme.js). A hard project rule: screens never hardcode hex values — everything consumes the theme.

### 2.1 Color tokens

| Token | Hex | Usage |
|---|---|---|
| `primary.main` | `#194391` | Buttons, links, active nav, focus rings (9.6:1 on white) |
| `primary.light` | `#4169e1` | Hover/derived accents |
| `primary.dark` | `#122f66` | Pressed states |
| `secondary.main` | `#475569` | Neutral emphasis (slate) |
| `success.main` | `#15803d` | Positive status |
| `warning.main` | `#b45309` | Caution status |
| `error.main` | `#dc2626` | Errors, destructive actions |
| `info.main` | `#0369a1` | Informational |
| `background.default` | `#f1f5f9` | Page canvas |
| `background.paper` | `#ffffff` | Cards, tables, dialogs |
| `text.primary` | `#0f172a` | Body text (slate-900) |
| `text.secondary` | `#475569` | Muted text — deliberately darker than Harbor's slate-500 to clear the 4.5:1 AA floor on the canvas |
| `divider` | `#e2e8f0` | Hairline borders (slate-200) |

**Status colors** (`STATUS_COLORS` in theme.js) encode *state*, never series identity, and always ship with a text label — never color alone:

| State | Hex |
|---|---|
| active / completed | `#15803d` |
| delayed | `#b45309` |
| archived / not_started | `#64748b` |
| in_progress | `#194391` |
| blocked | `#b91c1c` |

**Chart palette** (`CHART_COLORS`): `#2255b0`, `#15803d`, `#c2410c`, `#7c3aed` — assigned in fixed order, never cycled; a fifth series folds into "Other". The palette was validated for color-vision deficiency and surface contrast (rationale documented inline in theme.js); charts additionally carry direct labels, 2&nbsp;px gaps between fills, and a data-table fallback. **A designer changing these colors must re-validate contrast and CVD separation.**

**Dark mode.** The theme is built per mode by `buildTheme(mode)` in theme.js; a toggle in the top bar persists the choice (`localStorage: citi_color_mode`), first visits follow the OS `prefers-color-scheme`, and the `data-theme` attribute on `<html>` flips the CSS custom properties in step. Dark palette (brief v2 §3.1): canvas `#0b1220`, paper `#131c2e`, divider `#1e293b`, text `#e2e8f0`/`#94a3b8`, primary `#6d93e0` (6.2:1 on canvas; contained buttons flip to dark text), semantic hues lightened with dark contrast text (`#4ade80`/`#fbbf24`/`#f87171`/`#38bdf8`). **Status and chart colors have dark-validated counterparts** — `STATUS_COLORS_DARK` (in_progress `#6d93e0`, blocked `#f87171`) and `CHART_COLORS_DARK` (slot 0 `#6d93e0`, slot 3 `#a78bfa`) — consumed via the `useStatusColors()` / `useChartColors()` hooks, never by picking a set by hand. All dark pairings were computed against WCAG in 2026-07: every text pairing ≥4.5:1, every mark ≥3:1 on the paper tone (results annotated in theme.js). The focus ring rides `--color-focus-ring` (`#194391` light / `#8fabf0` dark).

### 2.2 Typography

Font: **Inter Variable**, self-hosted via `@fontsource-variable/inter` (no third-party CDN at runtime). Fallbacks: Segoe UI → Roboto → system stack.

| Role | Size / weight | Where used |
|---|---|---|
| h4 | 24 px / 600 | Page headings (`h1` element on every screen) |
| h6 | 18 px / 600 | Card and dialog headings |
| subtitle2 | 14 px / 600 | KPI card labels, field-group labels |
| body1 | 16 px / 400 | Primary body text |
| body2 | 14 px / 400 | Table cells, secondary text, nav items |
| button | 14 px / 600 | No uppercase transform (`textTransform: none`). Text-variant buttons step to **500**: row actions (Edit / Archive / Delete) repeat once per table row, and at 600 a column of them competes with the data. Filled/outlined CTAs keep 600. |
| caption | 12 px / 400 | Hints, footnotes, metadata |

### 2.3 Iconography

One icon set for the whole app: **lucide** line icons at a single **1.75 stroke weight**, default 20 px, matching Inter's optical weight. Screens never import from `lucide-react` directly — everything goes through [`components/icons.jsx`](../frontend/src/components/icons.jsx), which standardizes size and stroke and gives icons semantic names (`TeamsIcon`, `AddPersonIcon`, `DeleteIcon`). Never mix in Material/Font-Awesome icons, and never pass a custom `strokeWidth` — one weight is the discipline.

Empty states use three purpose-built line illustrations in the same stroke language ([`components/illustrations.jsx`](../frontend/src/components/illustrations.jsx)): `EmptyWorkIllustration` (projects/deliverables/resources/budgets), `EmptyPeopleIllustration` (teams/individuals/users), `EmptyDataIllustration` (insights/reports). The dashed strokes in each drawing represent the missing thing the empty state invites the user to create.

### 2.4 Space, shape, elevation

- **Spacing:** strict 8&nbsp;px grid (`theme.spacing(1)` = 8 px; `sx={{ p: 2 }}` = 16 px).
- **Radius:** 8 px on everything (`shape.borderRadius`).
- **Elevation:** flat. Cards/tables are white surfaces with hairline `divider` borders; buttons ship `disableElevation`. Dialogs are the only surfaces with shadow.
- **Table headers:** ledger caps — 12 px / 600, uppercase with 0.06 em tracking, `text.secondary` — closed by a **2px primary underline** (no gray wash); column names whisper so the data speaks. Numeric columns use `font-variant-numeric: tabular-nums`; row hover is a 3px left-edge primary bar, not a row tint.
- **Table density:** cells pad 10 px vertical / 16 px horizontal (down from MUI's 16/16) — data screens read as a ledger, not a form. Row height stays ≥40 px with body2, holding the 8 px rhythm and touch targets.
- **Focus:** every interactive element shows a 2 px outline with 2 px offset on `:focus-visible`, riding `--color-focus-ring` per mode; the navy sidebar uses the cream active tone for its focus ring so it stays visible on navy.

---

## 3. App shell

Implemented in [`frontend/src/components/AppLayout.jsx`](../frontend/src/components/AppLayout.jsx).

```
┌──────────┬─────────────────────────────────────────────────────────────────┐
│ CITI     │ UTILITY BAR (56 px, canvas tone) [🔍 search]  mode  name  logout │
│ PROJECT  ├─────────────────────────────────────────────────────────────────┤
│ MGMT ────│  MAIN CONTENT — centred max-width 1240 column, 32 px gutters    │
│ 232 px   │                                                                 │
│          │                                                                 │
│ Dashboard│                                                                 │
│ Projects │                                                                 │
│ Deliver… │                                                                 │
│ Resources│                                                                 │
│ Budgets  │  ← hidden unless admin/PM/finance                               │
│ Reports  │                                                                 │
│ Teams    │                                                                 │
│ Individ… │                                                                 │
│ Team Ins…│                                                                 │
│ Users    │  ← admin only                                                   │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

- **Brand in the sidebar, not the bar:** the navy column runs floor to ceiling and opens with the Fraunces "CITI" wordmark over a letter-spaced caption. The top bar is a 56 px utility strip on the canvas tone (hairline rule below) holding only the pill-shaped global search, the mode toggle and the user block (name over role, icon-only logout) — identity and utility never compete.
- **Measured content column:** pages render in a centred `max-width: 1240px` column with 32 px desktop gutters — a ledger column, not edge-to-edge sprawl.
- **Grouped navigation:** items sit under three letter-spaced caption section labels — **Work** (Dashboard, Projects, Deliverables, Resources, Budgets, Reports), **Teams** (Teams, Individuals, Team Insights), **Admin** (Users). A section renders only when the role can see at least one of its items.
- **Desktop (≥ md):** permanent drawer, 232 px, icon + label items; active item gets the warm off-white plate with navy text.
- **Tablet/mobile (< md):** drawer becomes temporary, opened by a hamburger button; user name hides from the top bar; single-column content.
- **Global search** in the top bar submits to `/search` (searches projects, deliverables, resources).
- **Role-aware nav:** items with a `roles` array only render for those roles (UX affordance — routes and backend enforce access independently).

---

## 4. Screen inventory

Every screen lives in [`frontend/src/pages/`](../frontend/src/pages/). All data screens implement the same four states: **loading (skeleton), error (with retry), empty (with call to action), loaded**.

### 4.1 Archetype A — the list screen

Used by: **Projects, Deliverables, Resources, Budgets, Users, Teams, Individuals** (and the four report tables inside Reports).

```
Page heading (h4)                                [Primary action]  ← role-gated
NN records · NN active · NN flagged        ← PageHeader summary (page identity)
┌──────────────────────────────────────────────────────────────┐
│ [optional filter toolbar]                          [Export]  │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Col ▲ │ Col │ Col │ Status chip │ Actions (right-align)  │ │
│ │ …rows, 10/25/50 per page…                                │ │
│ └──────────────────────────────────────────────────────────┘ │
│                    pagination controls                       │
└──────────────────────────────────────────────────────────────┘
```

Every list screen opens with [`PageHeader`](../frontend/src/components/PageHeader.jsx): the h4 title, a live count summary underneath ("24 projects · 6 active · 3 delayed"), and the role-gated primary action.

All tables come from one component — [`DataTable.jsx`](../frontend/src/components/DataTable.jsx) — which provides sorting, pagination, and CSV export declaratively. Status is always a small `Chip` with a text label.

**Below the `md` breakpoint the table becomes a card list**: each row renders as a stacked card — the first column as the card title, remaining columns as label:value lines, the actions column as a right-aligned footer. Sorting stays available through a "Sort by" select; pagination and CSV export are unchanged. Data tables never scroll horizontally on mobile.

### 4.2 Archetype B — the details screen

Used by: **Project details** (tabbed: deliverables / resources / budget) and **Team details** (two-column):

```
[← back] Team name (h4)  [location chip]
┌───────────────────── 5/12 ─────────┐ ┌──────────── 7/12 ─────────────┐
│ About card: leader, reports-to,    │ │ Monthly achievements card     │
│ metadata chips                     │ │  [Record achievement]         │
├────────────────────────────────────┤ │  ┌ May 2026 ┐ Title           │
│ Members card: roster list,         │ │  description…    Edit Delete  │
│ remove icons, add-member select    │ │  …                            │
└────────────────────────────────────┘ └───────────────────────────────┘
```

### 4.3 Archetype C — the KPI dashboard

Used by: **Dashboard** and **Team Insights**.

```
Page heading (h4)
Subtitle (body1, text.secondary)
┃ Needs attention                          ← attention tier: warning left border,
┃ Projects at risk · N │ Over-allocated ·     only what needs acting on today.
┃ N │ Over budget · N  (linked items)         All-clear = one quiet success strip.
┌ KPI ┐ ┌ KPI ┐ ┌ KPI ┐ ┌ KPI ┐ ┌ KPI ┐   ← steady-state KPI cards below it
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
┌──────────────────────────────────────┐
│ supporting table or charts           │   ← every KPI is auditable in the
└──────────────────────────────────────┘      table below it
```

The Dashboard leads with the **attention tier** (a `Paper` with a 3 px warning-colored left border): at-risk projects, over-allocated people, and over-budget projects, each item linked. When nothing qualifies, a single success-bordered strip says "All clear" — priority is signaled structurally, not by making every card compete.

Team Insights answers the workshop questions: teams count, leaders not co-located, non-direct leaders, non-direct ratio > 20%, teams reporting to an org leader — each KPI backed by a per-team flag column (warning-colored chips) in the table.

### 4.4 Archetype D — dialogs

- **Create/edit dialogs:** `maxWidth="xs"`, generous padding (32 px sides), heading + one-line description, stacked fields (16 px gaps), right-aligned Cancel / primary action in the footer. The submit button disables and re-labels while in flight ("Adding…"). Errors render as an inline `Alert` at the top of the dialog, which stays open.
- **Add user / Add individual** follow a 21st.dev "sign-up dialog" pattern: centered icon badge in a hairline circle, centered title + description, then the form. The user dialog's **role picker is a radio list where every option carries its permission summary** — the RBAC model is taught at the moment of decision.
- **Destructive confirmation:** always [`ConfirmDialog.jsx`](../frontend/src/components/ConfirmDialog.jsx) (never `window.confirm`) with a specific title ("Deactivate Ada Admin?"), a consequence sentence, and an error-colored confirm button.
- **Success feedback:** bottom-center `Snackbar` toast naming the object ("Nina Newhire added"), auto-hiding after 4 s.

### 4.5 Login

Centered 360 px card on the canvas: product name in primary 700, "Sign in to continue", email + password (show/hide toggle), full-width primary button, and a caption explaining accounts are created by administrators (no self-signup, by design).

### 4.6 Full screen list

| Route | Screen | Notable elements | Write access |
|---|---|---|---|
| `/login` | Login | card, password toggle, no-signup note | — |
| `/dashboard` | Dashboard | KPI row, charts, at-risk logic | — |
| `/projects` | Projects | filter toolbar, status chips | admin, PM |
| `/projects/:id` | Project details | tabs: deliverables / resources / budget | admin, own PM |
| `/deliverables` | Deliverables | dependency management | role-dependent |
| `/resources` | Resources | allocation %, over-allocation flags | admin, PM |
| `/budgets` | Budgets | currency amounts, over-budget flags | admin, PM, finance |
| `/reports` | Reports | four exportable report tables | read-only |
| `/search` | Search results | global search results | read-only |
| `/teams` | Teams | leader/member-count rollups, links to details | admin, PM |
| `/teams/:id` | Team details | roster, achievements, metadata chips | admin, PM |
| `/individuals` | Individuals | staff-type + org-leader chips, metadata editor | admin, PM |
| `/team-insights` | Team Insights | 5 KPI cards + audit table | read-only |
| `/users` | User management | sign-up-style dialog, descriptive role picker | admin only |

---

## 5. Shared component inventory

| Component | Path | Purpose |
|---|---|---|
| `DataTable` | `components/DataTable.jsx` | Declarative columns, sort, pagination, CSV export; card list below `md` |
| `PageHeader` | `components/PageHeader.jsx` | h4 title + live count summary + role-gated primary action |
| Icon set | `components/icons.jsx` | All icons — lucide, 1.75 stroke, 20 px, semantic names |
| Illustrations | `components/illustrations.jsx` | Three empty-state line drawings in the icon set's stroke language |
| `LoadingState` / `EmptyState` / `ErrorState` | `components/PageState.jsx` | The three non-loaded states, shaped like the content they replace |
| `ConfirmDialog` | `components/ConfirmDialog.jsx` | Destructive-action confirmation with in-flight/error handling |
| `MetadataEditor` | `components/MetadataEditor.jsx` | Key–value rows for free-form metadata on individuals/teams |
| `BarChart` / `DonutChart` / `LineChart` in `ChartFrame` | `components/charts/` | Charts with legend + data-table fallback |
| `AppLayout` | `components/AppLayout.jsx` | Shell: top bar, search, grouped role-aware drawer |
| `RoleCursorBadge` | `components/RoleCursorBadge.jsx` | Outlined role pill (admin/PM/team/finance/viewer) trailing the pointer; native cursor stays visible; off under reduced motion and on touch |
| `StatusIndicator` | `components/StatusIndicator.jsx` | Rounded-square status dot + label — status meaning; filled pills stay for counts |
| `KpiCard` | `components/KpiCard.jsx` | Hairline-top-rule KPI card, tabular figures, sub-200ms count-up |
| `useCountUp` | `hooks/useCountUp.js` | rAF count-up honoring prefers-reduced-motion |
| `ProtectedRoute` | `components/ProtectedRoute.jsx` | Auth/role route gating |

---

## 6. Interaction & content conventions

- **Forms:** validate before submit, inline errors, submit disabled while processing, success confirmation on completion (spec §11). Field labels are user-language ("Full name", "Reports to"), never schema-language.
- **Buttons say what they do** and keep their name through the flow: "Add team" (button) → "Add a team" (dialog) → "Add team" (submit) → "Quartz created" (toast).
- **Empty states direct action**: title + one sentence + the primary action ("No teams yet — Create your first team, then add members…").
- **Errors say what happened and offer retry**; they never apologize or go vague.
- **Destructive copy states the consequence**, not just "are you sure": "They'll no longer be able to sign in. Their work stays in place."
- **Numbers from the API arrive as strings** (Postgres `NUMERIC`) — always `Number()`-wrapped before math; ratios shown as percentages.
- **em dash (—)** is the standard empty-cell placeholder, not blank.

---

## 7. Accessibility baseline (already implemented)

- AA contrast on all text tokens (muted text was deliberately darkened; see §2.1).
- Visible focus outline on every interactive element, keyboard-driven dialogs with `aria-labelledby`.
- Status never conveyed by color alone (chips carry labels; charts carry direct labels + table fallback).
- Icon-only buttons always have `aria-label`s ("Remove Mia Torres", "Show password").
- Skeleton loaders declare `role="status"` with labels.

---

## 8. Known gaps & enhancement opportunities (designer's brief)

**Resolved in the 2026-07 glow-up** (kept here so the rationale isn't lost): grouped navigation (Work / Teams / Admin sections), dashboard attention tier, mobile card-list tables, unified lucide icon set at one stroke weight, purpose-built empty-state illustrations, page-identity headers with live counts, and link/underline-on-hover vs. filled-button differentiation.

Still open, in rough priority order:

1. **Achievements timeline.** Monthly achievements render as a flat list with month chips; a designer could make this a real timeline (grouped by month, visual rhythm) — it's the most "storytelling" surface in the app.
2. **Insights vs Reports.** Team Insights and Reports overlap conceptually; one merged "Insights" area may be cleaner information architecture.
3. **Metadata editor.** Functional key–value rows; visually utilitarian. Worth a pass if metadata becomes a first-class feature.
4. **Touch-target audit.** Row-action buttons in dense tables should be verified at 44×44 px effective hit area on touch devices.
5. **Print/export styling.** CSV export exists; PDF/print layouts do not.

### Constraints any redesign must respect

- Material UI component library (project requirement) — restyle via theme, don't fork components.
- 8 px spacing grid; tokens only (no hardcoded hex in screens).
- AA contrast floors, visible focus, label-not-color-alone (spec §14/§16).
- Status/chart color meanings and the CVD validation documented in theme.js.
- Every list keeps sort/search/filter/pagination; every form keeps the §11 flow; destructive actions keep confirmation dialogs.
- Reference specs: [`req/UI_UX_Design&UserFlow.md`](../req/UI_UX_Design&UserFlow.md) (§9 colors/type/spacing, §11 forms, §12 tables, §14–16 a11y/feedback) and [`req/Application_Flow.md`](../req/Application_Flow.md).

---

## Navigation Links

<nav aria-label="breadcrumb">
  <ol>
    <li><a href="./README.md">Main Guide</a></li>
    <li><a href="./validation.md">Validation Guide</a></li>
    <li><a href="./full-stack.md">Full Stack Guide</a></li>
    <li><a href="./data-engineer.md">Data Engineer Guide</a></li>
    <li><a href="./system-engineer.md">System Engineer Guide</a></li>
    <li aria-current="page">UI/UX Engineer Guide</li>
  </ol>
</nav>
