# Role & Permission Engine — Prototype Change PRD (MVP)

**Status:** Draft for review
**Author:** (you) · **Date:** June 2026
**Source of truth:** [Coda — Decision Record: Role & Permission Engine (rev. 6)](https://coda.io/d/KLAY_duyx7V0fPDD/Decision-Record-Role-Permission-Engine_suUm0dat)
**Scope of this doc:** what changes in the *current Klay prototype* to align with the Decision Record, cut to an MVP for our target customer (small, non‑manufacturing, typically single‑location).

---

## 1. Why this exists

The prototype today models permissions as **role × module × level** — which is exactly the "BEFORE" architecture the Decision Record was written to replace. This PRD defines the **minimum set of changes** to move the prototype onto the Decision Record's model, *without* building the enterprise machinery that doesn't fit our target.

The one-line goal: **roles become bundles of named capabilities, and segregation-of-duties is checked over those capabilities — not over role names.** Everything else is either kept as-is or explicitly deferred.

## 2. Target customer (the scoping lens)

Small business, non‑manufacturing, usually one location, no dedicated access administrator. This is the lens for every in/out decision below: if a feature only pays off for multi‑branch or enterprise-admin customers, it's deferred.

## 3. Decisions (in / out for MVP)

| Decision Record capability | MVP? | Rationale |
|---|---|---|
| Predefined, recognizable roles (no blank-canvas builder) | **In** | Already how the prototype works; matches the target. Custom roles stay v2. |
| Roles expressed as **capabilities** (not module×level) | **In** | The core model change. Precondition for capability-level SoD and for custom roles later. |
| **Capability-level SoD** (`create_vendor + pay_vendor`), block-as-you-build | **In** | The current role-pair SoD is the single biggest mismatch with the Decision Record. |
| **Submitter ≠ approver** control, Approve button **fully absent** for submitter | **In** | Cheap, high-trust, already half-present via the Access Policy page. |
| **Block in task language** + scope-aware empty states | **In** (light) | The denial UX; cheap and high-value. |
| Entity-wide Enforced/Relaxed control plane | **In** (keep) | Already built ([`AccessPolicyPage.jsx`](../src/pages/AccessPolicyPage.jsx)); good as-is. |
| **Branch / dimension scope picker** (Records axis) | **Out — deferred** | Multi-location problem; our target is single-location. Enterprise-machinery-for-a-small-team trap. |
| **"Own-records only" scope** | **Open** (recommend: out of MVP, first fast-follow) | Cheap single boolean and valuable even at 5 people, but still introduces resource-level filtering. See §8. |
| **Temporary / self-expiring access** | **Out — deferred** | It's the escape valve *for* tight restriction; a coarse MVP has few walls to hit. Drags in timers + auto-revoke + request flow. |
| **Review-queue surface** | **Out — deferred** | Keep the existing change-history log; a dedicated review queue waits until self-posts/SoD volume justifies it. |
| `authorize(user, action, resource)` seam | **In (shape only)** | Resolve permission checks through one helper that *accepts* a resource arg, even though MVP ignores scope. Keeps scope additive later without a rewrite. |
| Auth0 FGA in live path | **Out** | Per Decision Record — lab only, enterprise record-axis only. |

## 4. The model change (the heart of it)

### 4.1 Capability catalog (new)
A flat, data-driven list of actions the app understands. The vocabulary the engine reasons in. Example shape:

```
view_reports
gl: post_journal, view_gl
ap: create_bill, approve_bill, pay_vendor, create_vendor, view_ap
ar: create_invoice, approve_invoice, record_receipt, create_customer, view_ar
purchasing: create_po, approve_po
inventory: adjust_stock, receive_goods
settings: manage_users, manage_settings
```

The final catalog should be derived from the 8 seeded roles so every capability has at least one role that holds it.

### 4.2 Roles = sets of capabilities (changed)
Each predefined role becomes a named set of catalog entries instead of a `module × level` row.

- `AP Staff` = `{ create_bill, create_vendor, view_ap, view_gl, view_reports }`
- `Finance Manager` = `{ approve_bill, pay_vendor, approve_invoice, post_journal, view_*, ... }`

Roles keep `key`, `name`, `description`, `is_system`, `approval_limit`, `control_role`.

### 4.3 SoD = rules over capabilities (changed)
Replace the role-pair list with capability-pair rules:

- **Hard:** `create_vendor + pay_vendor`, `create_bill + approve_bill`, `create_invoice + approve_invoice`, `create_po + approve_po`, `post_journal + approve_*` … (final list TBD from the catalog).
- **Soft:** `manage_settings + (any approval capability)` — the "admin also approves" lean-team case.

The evaluator resolves a user's roles → their union of capabilities → checks capability conflicts → reports back **in role-name language** for the UI ("AP Staff + Finance Manager conflict on *create + pay*"). Role names stay in the UI; they leave the rule logic.

### 4.4 The `authorize` seam (new, thin)
One helper the app routes every gate through:

```
authorize(user, action /* capability */, resource /* optional */) -> boolean
```

- MVP resolves `action` against the user's capabilities. `resource` is accepted and ignored.
- This replaces scattered `hasLevel(module, level)` / `can(module)` calls.
- When scope ships later, the scope filter slots in here — no call-site churn.

## 5. Changes by file

### `src/data/seed/roles.js`
- Add `CAPABILITIES` catalog.
- Replace `PERMISSION_MATRIX` (module×level) with `ROLE_CAPABILITIES` (role → capability set). Keep `MODULES`/`LEVELS` only if still needed for any display; otherwise remove.
- Replace `SOD_RULES` role-pairs with capability-pair rules; rewrite `evaluateSod` to expand roles→capabilities first, then check capability conflicts. Keep the hard/soft return shape and the plain-English message.
- Seed users unchanged (still assigned roles by `roleKeys`).

### `src/state/CurrentUserContext.jsx`
- Derive the user's **capability set** (union across roles) instead of `accessibleModules` (highest module level).
- Expose `authorize(action, resource?)` / `can(capability)`; keep a thin compatibility shim if too many call sites depend on `hasLevel`/`level` to migrate at once.
- Route gating (`ROUTE_MODULE`, `landingPath`) re-expressed against a representative "view" capability per area.

### `src/pages/UsersPage.jsx`
- Role assignment UI unchanged (still check-box roles).
- SoD banner/justification flow unchanged in behavior; now fed by capability-level `evaluateSod`.
- `RoleDetailDrawer`: render the role's **capabilities** (from the catalog) instead of the module×level matrix.
- (If "own-records only" lands — see §8 — add a single toggle to the drawer.)

### Transaction UIs (bills, invoices, journal entries, etc.)
- Replace permission checks with `authorize(...)` using the relevant capability.
- **Approve/Post button is fully absent** when `user.id === submitted_by` (submitter ≠ approver), per the Decision Record — not greyed, not disabled.

### Block / empty-state UX (light, cross-cutting)
- When a route or list is out of the user's capability set, show a **plain-language explanation** (Bahasa), not an error code or a blank screen.
- No greyed dead-end controls: actions you can't perform aren't rendered; places you can't reach are explained.

### `src/pages/AccessPolicyPage.jsx`
- Keep as-is. Optionally reword copy that references the "role matrix" to "role capabilities."

## 6. Out of scope (explicit)

Branch/dimension scope picker · temporary/expiring access · dedicated review queue · custom-role builder · Auth0 FGA in the live path · multi-entity. Each remains a post-MVP item per the Decision Record's roadmap.

## 7. Acceptance criteria

1. A role's definition is a list of capabilities; the Role detail drawer renders capabilities, not a module×level grid.
2. SoD rules are defined over capability pairs; adding a hypothetical custom role that bundles a dangerous capability pair is flagged **without** editing any role-pair list.
3. The SoD banner still hard-blocks save and soft-requires a justification, with the same UX as today.
4. Every permission gate in the app routes through `authorize(action, resource?)`.
5. On a Pattern B posting, the submitter never sees an Approve/Post affordance for their own document.
6. Navigating to an out-of-access area yields a plain-language explanation, never a raw error or silent blank.
7. The Access Policy Enforced/Relaxed page continues to work unchanged.

## 8. Open decisions (need your call)

1. **"Own-records only" scope in MVP?** Recommendation: **defer**, but it's the cheapest first fast-follow. It's the only piece of the Records axis that pays off for a single-location small team (a clerk sees only the bills she entered). Keeping it out keeps MVP purely capability-based; putting it in means the `authorize` seam must actually filter on `resource.owner` now.
2. **Final capability catalog granularity** — how fine do we split (e.g. one `pay_vendor`, or `create_payment` + `approve_payment`)? Drives the SoD rules.
3. **Migration approach for `hasLevel` call sites** — big-bang rewrite to `authorize`, or ship a compatibility shim and migrate incrementally?

## 9. Sequencing

1. Catalog + `ROLE_CAPABILITIES` + capability-level `evaluateSod` in `roles.js` (self-contained, testable).
2. `authorize` seam + capability derivation in `CurrentUserContext.jsx` (+ shim).
3. Role detail drawer renders capabilities; Users SoD wired to new evaluator.
4. Submitter≠approver absent-button in transaction UIs.
5. Block/empty-state plain-language pass.
6. Copy cleanup on Access Policy.

Items 1–3 are the substance; 4–6 are polish that can follow.
