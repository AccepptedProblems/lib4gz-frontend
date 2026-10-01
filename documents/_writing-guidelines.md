---
owner: ntn071000@gmail.com
last_reviewed: 2026-05-06
review_cadence: quarterly
---

# Writing Guidelines

> **Compress ruthlessly.** A spec nobody reads doesn't exist. A spec that's outdated is worse than nothing — it gives false confidence. The job is to think, curate, and compress, not to generate and commit.

Every document in `documents/` must be clear enough for a new engineer to act on, structured enough for a tech lead to skim, and useful enough to drive an implementation 6 months from now.

---

## 1. If it's too long, you haven't thought hard enough

- **Length is not thoroughness — it's laziness.** Anyone can dump everything they know into a YAML file. The hard work is figuring out what matters and cutting the rest.
- **AI makes this worse, not better.** Generating 500 lines takes seconds. Discipline matters more, not less. AI output is a starting point, not a deliverable — cut, rewrite, own what remains.
- **Read every word before committing.** If you can't be bothered to read it, neither can your audience.
- **If you can't summarize it, you don't understand it.** The three-version rule (below) forces this.
- **Delete the filler.** Strip every sentence that doesn't carry new information.

---

## 2. The Three-Version Rule (for narrative docs)

Every PRD and tech-design document exists in three Markdown files, each self-contained, each serving a different reader.

| Version | Suffix | Length | Audience | Answers |
|---|---|---|---|---|
| **1-min** | `*-1min.md` | 5–10 bullets | Lead, PM, anyone scanning | *What is this and why does it matter?* |
| **5-min** | `*-5min.md` | 1–2 pages | Engineer picking up the work | *What are we building, what's decided, where are the boundaries?* |
| **Full** | `*-full.md` | As needed | Implementer, future maintainer | *Every detail, edge case, tradeoff, decision log.* |

- **Three files, not one.** Each version is standalone — the 5-min doesn't continue from the 1-min, it expands.
- **The 1-min is the entry point.** It links to the 5-min and full versions.
- **Update all three when scope changes.** Sync discipline is the cost of three files.

---

## 3. Single-version reference docs (the exception)

Some documents exist in **one** version only. The spec is the spec — it's either complete or wrong. No three-version split.

| Doc type | File | Why one version |
|---|---|---|
| API endpoints | `network/api-endpoints.yaml` | Contracts are precise or broken. |
| Data models | `network/models.yaml` | Schema is the source of truth. |
| Networking config | `network/networking.yaml` | Config is exact. |
| Design tokens | `design-system/tokens.yaml`, `color.yaml`, `typography.yaml`, `breakpoints.yaml`, `theme.yaml`, `icons.yaml` | Values, not narrative. |
| Component styles | `design-system/components.yaml` | CSS reference. |
| Per-screen contract | `screens/<id>/contract.yaml` | Routes, guards, file paths — machine-consumed. |
| Project index | `openspec.yaml` | One canonical index. |

Reference docs **do** still get an `owner`, `last_reviewed`, and `review_cadence` header.

---

## 4. User first

- **Start from the user's problem.** "We need a sidebar drawer" is not a requirement. "Mobile users can't see the module list" is.
- **Trace every component back to a user problem.** If you can't, question why it exists.
- **Don't dress up implementation as purpose.** `purpose:` should describe what the user gets, not what the code does.

---

## 5. Structure over prose

- **Bullets, tables, diagrams.** Not paragraphs.
- **Headings are navigation.** A reader should understand the doc from the table of contents alone.
- **Bold the key phrase in each bullet.** Readers scan bold text.
- **Tables for comparisons.** If you're weighing options, a table forces clarity.
- **Mermaid for flow.** A sequence or state diagram beats five paragraphs.

---

## 6. Decisions, not descriptions

- **State the decision up front.** "We chose a sidebar nav over tabs" — not three paragraphs of context first.
- **List the alternatives.** What was rejected and why? Stops the next engineer from re-evaluating.
- **Capture constraints.** Timeline, scope, dependencies — the *why* the obvious choice wasn't chosen.
- **Date your decisions.** Constraints change.

---

## 7. Scope is the most important section

Every PRD and tech design must explicitly state:

- **In scope:** what this doc/screen covers.
- **Out of scope:** what it explicitly does *not* cover, and why.
- **Out of scope ≠ never.** It means "not in this iteration." Say so.

Ambiguity in scope is the root cause of missed deadlines and scope creep.

---

## 8. No embedded implementation snapshots

- **Don't paste `current_implementation`, `current_template`, or `current_styles` into specs.** The code in `src/` is the source of truth — duplicating it guarantees drift.
- **Link, don't copy.** `contract.yaml` points at the component file path; readers open the file.
- **If a spec refers to a CSS class or signal name, cite it inline once.** Don't paste the surrounding 50 lines.

---

## 9. Living documents have owners

Every file (`.md` or `.yaml`) gains a header block:

```yaml
owner: <one person, not a team>     # individuals update docs; teams don't
last_reviewed: YYYY-MM-DD
review_cadence: per-release | quarterly | per-milestone
```

- **Stale docs are dangerous.** If you can't maintain it, mark it outdated.
- **Archive, don't delete.** Move retired docs to `documents/_archive/<id>/` with a README explaining why.

---

## 10. The smell test

If a doc reads like it was written by everyone and no one — it was written by AI and reviewed by nobody. Your reader can tell. Cut until it sounds like a person wrote it.
