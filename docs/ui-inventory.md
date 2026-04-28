# Klay UI inventory — input for design system

**Purpose**: hand this to the DS coworker. Shows every reusable visual currently rendered in the app, where it lives, and the variants in use. When the DS lands, this becomes the migration map.

**Snapshot date**: 2026-04-28
**Pages inventoried**: General Ledger, Journal Entry, Bills, Invoices, Vendors, Customers, Chart of Accounts, Dimensions

---

## Design tokens already in use

Defined in [src/index.css:4-17](../src/index.css). Worth aligning DS tokens to these names early — renaming later is the single most expensive cleanup.

| Group | Tokens |
|---|---|
| Brand | `--color-brand` (#B83D08), `--color-brand-hover` |
| Action (primary buttons / links) | `--color-action` (#1A46C8), `--color-action-hover` |
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary` |
| Surface | `--color-surface-base`, `--color-surface-raised`, `--color-surface-sunken`, `--color-surface-deep` |
| Border | `--color-border-default` |
| Status | `--success-{text,border,surface}`, `--warning-{text,border,surface}`, `--danger-{text,border,surface}` |
| AI | `--ai-surface`, `--ai-border` |
| Radius | `--radius-sm` (6), `--radius-md` (10), `--radius-lg` (14), `--radius-full` |
| Transition | `--transition-fast` (.1s), `--transition-base` (.15s) |
| Font | `--font-sans` (Instrument Sans), `--font-mono` (Inconsolata) |

Body font-size baseline is **13px** — unusually small. Confirm with DS coworker.

---

## Components needed from the DS

### 1. Badge / Pill
**Used everywhere**. Currently 4 separate implementations.

| Variant | Where | Example values |
|---|---|---|
| Payment status | Bills, Invoices | Lunas, Belum Bayar, Jatuh Tempo |
| Approval status | Bills, Invoices | Approved, Review, Draft, Terkirim |
| Document/JE status | Journal Entry | Posted, Draft, Pending, Void |
| Category | Vendors | Inventory, Service, Expense, Koperasi, Individu |
| Active flag | Vendors, Customers | Aktif, Non-aktif |
| Customer type | Customers, Invoices | Perusahaan, Individu |
| Account type | Chart of Accounts | Asset, Liability, Equity, Revenue, Expense |
| GRN match | Bills | Matched, Pending, Mismatch |
| AI marker | Bills, Invoices, JE | "AI" pill (gradient surface) |

**Tone palette in use**: success (green), warning (amber), danger (red), info/action (blue), neutral (grey), AI (blue gradient), brand (orange).
**Shape variants**: rounded-sm rectangle (most), pill/full-radius (status-badge), uppercase-letterspaced (status-badge).

CSS sources: `.badge-*`, `.cat-badge`, `.status-badge`, `.type-badge`, `.type-badge-coa`, `.je-status` in [modules.css:224-253](../src/pages/modules.css), [GeneralLedgerPage.css](../src/pages/GeneralLedgerPage.css), [index.css](../src/index.css).

### 2. Page header / Hero banner
**Three distinct styles in use** — DS should consolidate to one with variants.

| Style | Where | Notes |
|---|---|---|
| **Plain header** (`.page-head`) | Vendors, Customers, Dimensions | Title + subtitle + right-side action buttons. Light surface. |
| **Orange "oz" banner** (`.oz-banner`) | Bills | Brand-colored, contains 4 stat cards inline |
| **Orange "inv" banner** (`.inv-banner`) | Invoices | Same but cards scroll horizontally; right-side AR pill instead of action |
| **Command Center band** (`.cc-band`) | Journal Entry | Multi-row: title + actions + 4 status tiles + expandable checklist + AI log |
| **GL command center** (`.gl-cmd`) | General Ledger | Similar to JE but adds closing workflow strip and AI co-pilot trigger |

Common features: page title, subtitle/breadcrumb, right-aligned actions (Export, primary CTA), optional inline stat cards.

### 3. Summary / KPI card
Card-on-banner pattern: small label, big number, sub-text, money amount.

- `.oz-card` (Bills, on orange banner, 4-up grid)
- `.inv-bc` (Invoices, on orange banner, horizontal scroll)
- `.cc-tile` (Journal Entry, status counts)
- `.drawer-stat-card` (in drawers, 2-up)

Variants: number tone (default / danger / warn), amount tone (default / danger / warn), with-CTA vs without.

### 4. Drawer (right-side detail panel)
**Repeated 3 times nearly identically** — Bills, Invoices, Vendors. Each has overlay, header (avatar + title + close), tab strip, body sections, footer with actions.

Sub-elements the drawer needs:
- **Tab strip** (`.drawer-tabs`, `.drawer-tab`) — 2–3 tabs typically
- **Stat row** (2-up KPI cards inside drawer)
- **Section** (`.drawer-section`, `.drawer-section-title`) — labeled group of rows
- **Label/value row** (`.drawer-row`, `.drawer-label`, `.drawer-value`) — definition-list pattern
- **Items table** (`.items-table`) — line items with totals row
- **Audit timeline** (`.audit-list`, `.audit-item`, `.audit-dot`) — colored dot + action + by/when
- **Footer button row** (`.drawer-footer`, `.drawer-btn` primary/ghost)

GL has its own larger drawer ([GeneralLedgerPage.css](../src/pages/GeneralLedgerPage.css), `.gl-drawer-*`) with anomaly cards, dimension chips, currency strip — confirm whether that's a variant of the same component or a different "inspector" pattern.

### 5. Filter bar
Same shape on every list page: `.filter-bar` = search input + separator + chip group.

- Search input (`.f-search`) — magnifier icon, placeholder, full-width left
- Separator (`.fsep`) — thin vertical rule
- Chip group (`.chip-grp`) of toggleable chips (`.chip`, `.chip.on`)
- Sometimes a second chip group for time ranges (Bulan ini / Q1 2025)

### 6. Data table
Shared shell across Bills, Invoices, Vendors, JE, GL. CSS in `.tbl-wrap`, `.je-table-wrap`, `.gl-table-wrap` — three near-duplicates.

Features needed:
- Sortable columns (sort indicator: ↕ / ↑ / ↓)
- Right-aligned numeric column (`.r`, `.td-num`, `.td-mono`)
- Selectable rows (checkbox column)
- Selected-row highlight (`.sel`, blue tint)
- Status row tints (`.row-draft`, `.row-pending`, `.row-void`)
- Inactive row dim (`.inactive-row`)
- Empty state row (`.tbl-empty`)
- Avatar cell (square initials block, color by category — see Avatar)
- Two-line cell (`.td-name` + `.td-sub`)
- Hover row, click row to open drawer

### 7. Sticky bottom bar (status footer)
Dark bar pinned to bottom of page. Used by Bills, Invoices, Vendors, JE, GL.

- Stat group (`.sb-st` / `.je-bar-stat`) = label + value, separator dots between groups
- Right-aligned: pagination (page size select + prev/next buttons)
- Color tones for values: default, danger, success, debit, credit

JE/GL versions are dark; Bills/Invoices/Vendors versions are lighter — confirm whether one footer or two.

### 8. Avatar / Initials block
Square rounded block with 2-letter initials, colored by category.

- `.vn-av` (vendor, color by `category` — inventory/expense/service/cooperative/individual)
- `.cn-av` (customer, color by `type` — perusahaan/individu)
- `.drawer-av` (larger version inside drawer header)
- `.sb-av` (sidebar profile, blue)
- `.org-avatar` (topbar org switcher, blue)

Sizes in use: 22, 26, 28, ~36 (drawer). Confirm DS sizing scale.

### 9. Attention / Alert banner (collapsible)
Yellow bordered card with icon + title + chevron, body has nested accordion sections.

- Bills: `.attn-section` with nested `.child-acc` accordions per category (Overdue / Unpaid / Draft)
- Vendors: `.attn-wrap` with nested `.acc` accordions (Outstanding AP / Stale)
- Customers: `.wb` ("warning banner") with item card grid (different shape from Bills/Vendors — DS should pick one)

### 10. Item card (inside attention banners)
Small bordered tile with reference, name, sub-text, footer with action button + amount.

- `.bill-row-item` (Bills, single line layout)
- `.item-card` (Vendors, multi-line layout)
- `.wb-item-card` (Customers, multi-line + status badge top-right)

Three different visual treatments for the same content shape — collapse to one.

### 11. Buttons
| Class | Use | Notes |
|---|---|---|
| `.btn-primary`, `.btn.btn-primary` | Solid action blue | Two slightly different definitions |
| `.btn-ghost` | Outlined / neutral action | |
| `.oz-btn`, `.oz-btn.primary` | Buttons inside orange banner | White-on-orange variants |
| `.btn-klayai` | "Klay AI" launcher | Gradient/glow treatment |
| `.btn-cc-export` | Command-center secondary | |
| `.drawer-btn` primary/ghost | Button row inside drawer footer | |
| `.bulk-btn` | Bulk actions when rows selected | |
| `.btn-sm`, `.btn-pay`, `.btn-bill` | Tiny buttons inside item cards | |
| `.wb-btn-primary`, `.wb-btn-secondary` | Customer-page item card buttons | |
| `.cl-cta` (`-bad`/`-warn`/`-ok`) | Inline CTA in checklist row | |

**Need from DS**: button component with size (sm/md), variant (primary/ghost/subtle), and tone (default/danger/warning/success/ai) props. Currently we have ~10 ways to render a button.

### 12. Sidebar nav
[Sidebar.jsx](../src/components/Sidebar.jsx) is internal — likely not part of DS, but it uses primitives (search input, notification button, nav item, expandable nav section, profile block) that DS may want to ship.

### 13. AI chat / co-pilot
GL page has a full AI chat surface (`.gl-ai-*`): bubble messages (user vs ai), suggestion chips, typing indicator, input with auto-resize, dismissable tip. JE page references "Klay AI" button + chip log inline. **Consider whether DS owns chat primitives or whether this is product-specific.**

### 14. Bulk action bar
Appears when rows selected — `.bulk-bar` with count + action buttons + close. JE has it; others don't yet.

### 15. Toggle / switch
`.toggle-sw` in Chart of Accounts for active/inactive. Single use today, but likely needed across forms.

### 16. Form primitives (not yet built — needed)
The current pages don't have real forms yet (everything is read/select). When forms come we'll need: text input, select, date input, number/money input, NPWP input (Indonesian tax ID format), checkbox, radio, textarea, file upload, validation messages.

### 17. Indonesian-specific bits
Confirm whether DS owns these or product code does:
- Rupiah formatter (`Rp 1.500.000` — Indonesian locale grouping)
- NPWP / tax ID display + input mask (`12.345.678.9-012.000`)
- Indonesian date format (`15 Apr 2025`, with `Mei`/`Agu`/`Okt`/`Des` short months)
- PPN / PPh tax-rate badges with code labels
- WhatsApp link helper (`toWA(phone)` in [CustomersPage.jsx:19](../src/pages/CustomersPage.jsx))

---

## Patterns to deprecate when DS lands

These are page-specific class prefixes that should disappear in the migration:

- `oz-*` (Bills banner) → DS PageHeader variant
- `inv-banner-*`, `inv-bc-*` (Invoices banner) → DS PageHeader variant
- `cc-*`, `ct-*`, `cl-*`, `al-*` (JE command center) → DS PageHeader + KPI tile + checklist row
- `gl-*` (entire GL stylesheet, 1525 lines) → DS PageHeader + table + drawer + chat
- `attn-*`, `wb-*`, `acc-*`, `child-acc-*` (attention banners) → one DS Alert/Accordion
- `drawer-*` → DS Drawer
- `vn-av`, `cn-av`, `drawer-av`, `sb-av` → DS Avatar
- `chip`, `chip.on` → DS Chip / ToggleGroup
- All the `badge-*` / `cat-badge` / `status-badge` / `type-badge` variants → DS Badge

---

## Open questions for DS coworker

1. **Distribution model**: npm package, copy-paste components, monorepo workspace, or Tailwind preset?
2. **Styling approach**: Tailwind utilities, CSS modules, CSS-in-JS, or vanilla CSS with class names?
3. **Token alignment**: do your tokens map to ours (`--color-brand`, `--success-text`, etc.) or are we renaming?
4. **Component API conventions**: prop shape for variants — `variant="primary" tone="danger"` vs `kind` vs separate components?
5. **Indonesia-specific**: who owns Rupiah/NPWP/Indonesian-date primitives — DS or product?
6. **AI chat primitives**: DS responsibility, or product-only?
7. **Density**: our body text is 13px. Is your DS sized for 13/14/16px base?
8. **Dark mode**: in scope? GL command-center band uses a dark surface variant already.
9. **Animation/motion tokens**: we have `--transition-fast` and `--transition-base` plus a few keyframes (`gl-badgePulse`, `gl-typingBounce`, `gl-aiPulse`). Migrate to DS motion tokens?
10. **Sticky bottom bar**: dark on JE/GL, light on Bills/Invoices/Vendors — pick one.

---

## Migration ordering (when DS ships)

Easiest → hardest, so we get wins early:

1. **Badge** — atomic, ~50 usages, mechanical replace
2. **Button** — ~10 button styles → one component
3. **Chip / Filter bar**
4. **Avatar**
5. **Page header** (3 variants → one with props)
6. **Summary/KPI card**
7. **Data table** (touches every list page)
8. **Drawer** (touches Bills, Invoices, Vendors)
9. **Attention banner** (3 different shapes today — biggest design decision)
10. **Command center / AI chat** (last — most page-specific, may stay in product)
