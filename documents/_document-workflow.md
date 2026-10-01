---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: quarterly
---

# Document Workflow

> Every Jira ticket that adds or changes a screen, layout, or shared component must have documentation **before** code. No PRD, no tech design, no implementation. This document defines what to write, in what order, and where it goes.
>
> All documents follow `_writing-guidelines.md`. The three-version rule applies to PRDs and tech designs; reference docs (API, models, tokens, contracts) are single-version.

---

## The order: product first, then technical

```
Jira ticket created
  → 1. Product Requirements (prd-1min.md)              ← user-facing intent
  → 2. Tech Design (design-1min.md)                    ← engineering decisions
  → 3. Contract (contract.yaml)                        ← machine-readable spec
  → 4. Implementation begins
```

**An engineer who starts coding before the PRD is reviewed is solving a problem they haven't verified exists.**

---

## File layout per screen

```
documents/screens/<screen-id>/
  prd-1min.md          # required — problem, user, success metric
  prd-5min.md          # required — + scope, user stories, risks
  prd-full.md          # required for new screens — + acceptance criteria, edge cases
  design-1min.md       # required — what we're building, key arch decision
  design-5min.md       # required — + system context, tradeoffs, scope
  design-full.md       # required for new screens — + decision log, failure modes
  contract.yaml        # required — routes, guards, component paths, links
```

Sub-components (e.g., `lesson-detail-management`) get the same structure under `screens/<parent>/<sub-id>/`.

---

## 1. Product Requirements (PRD)

Written from the **user's** point of view. No technical jargon. Describe the world as the user sees it.

### What every PRD must answer

- **Problem.** What's broken, missing, or insufficient today?
- **User group.** Who is affected? Who is the primary beneficiary?
- **Outcome.** What changes for the user when this ships?
- **Success metric.** How do we measure that it worked? (quantifiable)
- **Scope (in/out).** Explicit boundaries.

### Three versions

| Version | Contains |
|---|---|
| `prd-1min.md` | Problem, primary user, outcome, success metric, target date |
| `prd-5min.md` | + user stories, scope (in/out), key assumptions, risks, dependencies |
| `prd-full.md` | + detailed acceptance criteria per story, wireframes (link), edge cases, analytics |

---

## 2. Tech Design

Written **after** the PRD is reviewed. Every technical decision must trace back to a PRD requirement. If it doesn't, question why it exists.

### What every tech design must answer

- **What we're building.** One sentence.
- **Key architectural decision.** "Sidebar nav over tabs because…" + alternatives rejected.
- **System context.** How does this fit existing screens, services, and shared components?
- **Data flow.** What signals, services, and APIs are involved.
- **Tradeoffs.** What we gave up to get the chosen approach.
- **Scope (in/out).** Mirrors the PRD; restate so the design doc is standalone.
- **Failure modes.** What can go wrong (network down, 401, empty data) and how the UI handles it.

### Three versions

| Version | Contains |
|---|---|
| `design-1min.md` | What we're building, key decision, risk summary |
| `design-5min.md` | + system-context diagram, data flow, key tradeoffs, scope |
| `design-full.md` | + component map, failure modes, decision log with dates, open questions |

---

## 3. Contract (single-version YAML)

`contract.yaml` is the machine-consumable spec. **No prose.** Holds:

```yaml
openspec: "1.0"
kind: ScreenContract
owner: <email>
last_reviewed: YYYY-MM-DD
review_cadence: per-release

screen:
  id: <screen-id>
  name: <Human Name>
  routes:
    - <path>
  guard: [<guard-name>, ...]
  guard_data:
    roles: [...]
  target_users: [<role>, ...]
  status: scaffold | implemented | deprecated

component:
  selector: app-<name>
  file: src/app/components/.../<name>.component.ts
  template: src/app/components/.../<name>.component.html
  styles: src/app/components/.../<name>.component.scss
  standalone: true

related_docs:
  prd: [prd-1min.md, prd-5min.md, prd-full.md]
  design: [design-1min.md, design-5min.md, design-full.md]
  api_endpoints: [<endpoint-id>, ...]    # references to network/api-endpoints.yaml
  models: [<model-id>, ...]              # references to network/models.yaml
  shared_components: [lib-button, ...]   # references to design-system/shared-components/
```

That's it. Anything beyond this list belongs in a `.md`.

---

## Checklist: before moving the ticket to "In Progress"

- [ ] **`prd-1min.md` exists** — problem, user, outcome are clear
- [ ] **PRD reviewed** — at least one product + one engineering sign-off
- [ ] **Scope (in/out) is explicit** — no ambiguity
- [ ] **`design-1min.md` exists** — key decision is recorded with alternatives
- [ ] **`contract.yaml` exists** — routes, guards, component paths set
- [ ] **Tech design reviewed** — at least one lead engineer sign-off
- [ ] **Acceptance criteria defined** in `prd-full.md`

---

## Reference docs (no PRD/design needed)

These are single-version YAML reference data — they are written and updated, but they don't follow the PRD → design → implementation flow:

- `design-system/tokens.yaml`, `color.yaml`, `typography.yaml`, `breakpoints.yaml`, `theme.yaml`, `icons.yaml`, `components.yaml`
- `design-system/shared-components/<component>.yaml` (one file per shared component)
- `network/api-endpoints.yaml`, `models.yaml`, `networking.yaml`
- `openspec.yaml`

When changing a reference doc, bump `last_reviewed` and ping the owner.

---

## Archive policy

- Deprecated screens move to `documents/_archive/<screen-id>/` with a `README.md` stating: replaced by which screen, on what date, why.
- The deprecated entry stays in `openspec.yaml` under an `archived:` block (not `screens:`) so old links still resolve.
- **Never delete.** Future search will look for it.
