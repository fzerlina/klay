// Roles, permission matrix, Segregation-of-Duties rules, and sample users.
// Sourced from the Role Management PRD. Prototype data — no backend.

// ── Roles ────────────────────────────────────────────────────────────────
// is_system roles ship with Klay and cannot be deleted (only cloned).
// approval_limit is the max Rupiah value a role may approve (null = none).
export const ROLES = [
  {
    key: "admin",
    name: "Admin",
    description: "Full access to all modules, settings, and user management. Can configure the system but should generally avoid routine operational transactions.",
    is_system: true,
    approval_limit: null,
    control_role: true,
  },
  {
    key: "finance_manager",
    name: "Finance Manager",
    description: "Approves and posts transactions across the finance modules. Holds the primary approval authority.",
    is_system: true,
    approval_limit: 100000000,
    control_role: true,
  },
  {
    key: "ap_staff",
    name: "AP Staff",
    description: "Creates and manages bills, payment vouchers, and vendor records. Cannot approve their own payments.",
    is_system: true,
    approval_limit: null,
    control_role: false,
  },
  {
    key: "ar_staff",
    name: "AR Staff",
    description: "Creates and manages sales invoices, cash receipts, and customer records.",
    is_system: true,
    approval_limit: null,
    control_role: false,
  },
  {
    key: "bookkeeper",
    name: "Bookkeeper",
    description: "Records and posts journal entries and maintains the general ledger. Cannot approve high-value postings.",
    is_system: true,
    approval_limit: null,
    control_role: false,
  },
  {
    key: "purchasing_staff",
    name: "Purchasing Staff",
    description: "Creates purchase orders and manages the procurement process. No access to financial records.",
    is_system: true,
    approval_limit: null,
    control_role: false,
  },
  {
    key: "warehouse_staff",
    name: "Warehouse Staff",
    description: "Manages goods receipts, stock, and inventory adjustments. No access to the finance modules.",
    is_system: true,
    approval_limit: null,
    control_role: false,
  },
  {
    key: "view_only",
    name: "View Only",
    description: "Read-only access to reports and data. Cannot create or change any transactions.",
    is_system: true,
    approval_limit: null,
    control_role: false,
  },
];

// ── Modules ──────────────────────────────────────────────────────────────
export const MODULES = [
  { key: "gl", label: "General Ledger", desc: "Journals, ledger, trial balance" },
  { key: "ap", label: "Accounts Payable", desc: "Bills, payment vouchers, vendors" },
  { key: "ar", label: "Accounts Receivable", desc: "Invoices, cash receipts, customers" },
  { key: "purchasing", label: "Purchasing", desc: "Purchase orders & procurement" },
  { key: "inventory", label: "Inventory", desc: "Stock, goods receipts, adjustments" },
  { key: "reports", label: "Reports", desc: "Financial reports & analytics" },
  { key: "settings", label: "Settings", desc: "System & user configuration" },
];

// ── Permission levels ──────────────────────────────────────────────────────
// Ordinal rank used for matrix coloring & comparisons.
export const LEVELS = {
  none: { rank: 0, label: "None" },
  view: { rank: 1, label: "View" },
  transact: { rank: 2, label: "Transact" },
  approve: { rank: 3, label: "Approve" },
  post: { rank: 4, label: "Post" },
  "approve+post": { rank: 5, label: "Approve + Post" },
  full: { rank: 6, label: "Full" },
};

// ── Permission matrix ──────────────────────────────────────────────────────
// roleKey → { moduleKey: levelKey }
export const PERMISSION_MATRIX = {
  admin: {
    gl: "full", ap: "full", ar: "full", purchasing: "full",
    inventory: "full", reports: "full", settings: "full",
  },
  finance_manager: {
    gl: "approve+post", ap: "approve+post", ar: "approve+post", purchasing: "approve",
    inventory: "view", reports: "full", settings: "view",
  },
  ap_staff: {
    gl: "view", ap: "transact", ar: "none", purchasing: "view",
    inventory: "none", reports: "view", settings: "none",
  },
  ar_staff: {
    gl: "view", ap: "none", ar: "transact", purchasing: "none",
    inventory: "none", reports: "view", settings: "none",
  },
  bookkeeper: {
    gl: "transact", ap: "view", ar: "view", purchasing: "none",
    inventory: "none", reports: "view", settings: "none",
  },
  purchasing_staff: {
    gl: "none", ap: "none", ar: "none", purchasing: "transact",
    inventory: "view", reports: "view", settings: "none",
  },
  warehouse_staff: {
    gl: "none", ap: "none", ar: "none", purchasing: "view",
    inventory: "transact", reports: "view", settings: "none",
  },
  view_only: {
    gl: "view", ap: "view", ar: "view", purchasing: "view",
    inventory: "view", reports: "view", settings: "none",
  },
};

// ── Segregation-of-Duties rules (for display) ──────────────────────────────
// HARD = cannot be combined on one user (blocks the save).
// SOFT = allowed but requires a typed justification.
//
// Per the Role Management PRD (§sod_rules): a HARD conflict is whenever one user
// would hold `transact` AND `approve` on the SAME module — which in practice is
// any operational role paired with the Finance Manager on that role's module
// (this also covers the PRD's "create vendor + approve payment" case via AP).
// The ONLY SOFT pair is Admin + Finance Manager. Operational roles (AP, AR,
// Purchasing, Warehouse) carry no approval authority, so they combine freely
// with one another and raise no flag — e.g. AP + AR is explicitly not a conflict.
export const SOD_RULES = {
  hard: [
    {
      roles: ["ap_staff", "finance_manager"],
      module: "ap",
      reason: "The same user could create bills (and vendor records) and approve their payment — transact + approve on Accounts Payable.",
    },
    {
      roles: ["ar_staff", "finance_manager"],
      module: "ar",
      reason: "The same user could create invoices and approve/post their receipts — transact + approve on Accounts Receivable.",
    },
    {
      roles: ["purchasing_staff", "finance_manager"],
      module: "purchasing",
      reason: "The same user could raise purchase orders and approve them — transact + approve on Purchasing.",
    },
    {
      roles: ["bookkeeper", "finance_manager"],
      module: "gl",
      reason: "The same user could record journal entries and approve/post them — transact + approve on General Ledger.",
    },
  ],
  soft: [
    {
      roles: ["admin", "finance_manager"],
      reason: "Combining full system control with financial approval authority concentrates execution and oversight in one person — permitted on lean teams with a recorded justification.",
    },
  ],
};

// ── SoD evaluation ─────────────────────────────────────────────────────────
const BLOCK_NO_APPROVER =
  "No approver is available for this module. Add a user with the Finance Manager role.";

function roleName(key) {
  const r = ROLES.find((x) => x.key === key);
  return r ? r.name : key;
}

function hasPair(roleKeys, pair) {
  return pair.every((k) => roleKeys.includes(k));
}

// Returns { level: 'none'|'soft'|'hard', message, conflicts:[{roles,module?,reason}] }
// HARD always wins over SOFT. message is plain English for direct UI use.
export function evaluateSod(roleKeys) {
  const keys = Array.from(new Set(roleKeys || []));
  if (keys.length < 2) return { level: "none", message: "", conflicts: [] };

  const hard = SOD_RULES.hard.filter((rule) => hasPair(keys, rule.roles));
  if (hard.length) {
    const names = hard
      .map((c) => c.roles.map(roleName).join(" + "))
      .join("; ");
    return {
      level: "hard",
      message: `Segregation of duties conflict: ${names} cannot be combined on one user.`,
      conflicts: hard,
    };
  }

  const soft = SOD_RULES.soft.filter((rule) => hasPair(keys, rule.roles));
  if (soft.length) {
    const names = soft
      .map((c) => c.roles.map(roleName).join(" + "))
      .join("; ");
    return {
      level: "soft",
      message: `Segregation of duties warning: ${names} should be held by different people. Provide a justification to proceed.`,
      conflicts: soft,
    };
  }

  return { level: "none", message: "", conflicts: [] };
}

// Backwards-friendly alias used by drawer flows.
export const checkSodConflict = evaluateSod;

export { BLOCK_NO_APPROVER };

// ── Sample users ───────────────────────────────────────────────────────────
// status: "Active" | "Invited" | "Inactive"
// Simulates an ~80-person company: 10 named "anchor" users (stable IDs U001–U010
// referenced elsewhere) plus a deterministic generator filling out the roster to
// 80 across the 7 roles. Generation is deterministic (no randomness) so the list
// is identical on every render.

const ANCHOR_USERS = [
  { id: "U001", name: "Andi Wijaya", email: "andi.wijaya@klay.id", roleKeys: ["admin"], status: "Active", approval_limit: null, lastActive: "2026-06-07", invitedOn: "2025-01-12" },
  { id: "U002", name: "Sari Dewanti", email: "sari.dewanti@klay.id", roleKeys: ["finance_manager"], status: "Active", approval_limit: 100000000, lastActive: "2026-06-06", invitedOn: "2025-01-12" },
  { id: "U003", name: "Budi Santoso", email: "budi.santoso@klay.id", roleKeys: ["ap_staff"], status: "Active", approval_limit: null, lastActive: "2026-06-07", invitedOn: "2025-02-03" },
  { id: "U004", name: "Rina Kartika", email: "rina.kartika@klay.id", roleKeys: ["ar_staff"], status: "Active", approval_limit: null, lastActive: "2026-06-05", invitedOn: "2025-02-03" },
  { id: "U005", name: "Dimas Prasetyo", email: "dimas.prasetyo@klay.id", roleKeys: ["purchasing_staff"], status: "Active", approval_limit: null, lastActive: "2026-06-04", invitedOn: "2025-03-18" },
  { id: "U006", name: "Maya Lestari", email: "maya.lestari@klay.id", roleKeys: ["warehouse_staff", "purchasing_staff"], status: "Active", approval_limit: null, lastActive: "2026-06-03", invitedOn: "2025-03-18" },
  { id: "U007", name: "Eko Nugroho", email: "eko.nugroho@klay.id", roleKeys: ["view_only"], status: "Active", approval_limit: null, lastActive: "2026-05-28", invitedOn: "2025-04-22" },
  { id: "U008", name: "Putri Handayani", email: "putri.handayani@klay.id", roleKeys: ["ap_staff"], status: "Invited", approval_limit: null, lastActive: null, invitedOn: "2026-06-02" },
  { id: "U009", name: "Galih Ramadhan", email: "galih.ramadhan@klay.id", roleKeys: ["ar_staff"], status: "Inactive", approval_limit: null, lastActive: "2025-11-14", invitedOn: "2025-05-09" },
  { id: "U010", name: "Lutfi Hakim", email: "lutfi.hakim@klay.id", roleKeys: ["finance_manager"], status: "Active", approval_limit: 100000000, lastActive: "2026-06-06", invitedOn: "2025-05-09" },
  { id: "U011", name: "Hana Wijoyo", email: "hana.wijoyo@klay.id", roleKeys: ["bookkeeper"], status: "Active", approval_limit: null, lastActive: "2026-06-06", invitedOn: "2025-02-20" },
];

const FIRST_NAMES = [
  "Agus", "Dewi", "Fajar", "Indah", "Hadi", "Citra", "Bayu", "Ratna", "Yoga", "Sinta",
  "Rizki", "Ayu", "Teguh", "Wulan", "Iwan", "Nadia", "Surya", "Mira", "Doni", "Mega",
  "Hendra", "Fitri", "Arif", "Tari", "Reza", "Dian", "Bagus", "Vina", "Krisna", "Yuni",
  "Adit", "Rara", "Faisal", "Nita", "Gilang", "Sasha", "Bram", "Laras", "Yusuf", "Intan",
];

const SUR_NAMES = [
  "Saputra", "Anggraini", "Pratama", "Maharani", "Kusuma", "Permata", "Wibowo", "Utami", "Halim", "Setiawan",
  "Gunawan", "Puspita", "Hartono", "Rahmawati", "Suryadi", "Cahyani", "Firmansyah", "Oktaviani", "Nurdin", "Widodo",
  "Susanto", "Melati", "Hidayat", "Purnama", "Iskandar", "Damayanti", "Mahendra", "Safitri", "Aprilia", "Andriani",
  "Wardana", "Lestari", "Pranata", "Septiani", "Kurniawan", "Handoko", "Marpaung", "Sihombing", "Nasution", "Siregar",
];

// Primary role for each generated user (sums to 70 → 80 with anchors).
const ROLE_PLAN = [
  ["warehouse_staff", 22],
  ["ap_staff", 12],
  ["ar_staff", 12],
  ["purchasing_staff", 11],
  ["view_only", 10],
  ["finance_manager", 2],
  ["admin", 1],
];

function buildGeneratedUsers() {
  const primaries = [];
  for (const [key, n] of ROLE_PLAN) for (let i = 0; i < n; i++) primaries.push(key);

  return primaries.map((primary, idx) => {
    const seq = idx + 12; // continues after U011
    const first = FIRST_NAMES[idx % FIRST_NAMES.length];
    const sur = SUR_NAMES[(idx * 7) % SUR_NAMES.length];
    const name = `${first} ${sur}`;
    const email = `${first}.${sur}${seq}@klay.id`.toLowerCase();

    const roleKeys = [primary];
    let justification = null;
    // A few clean operational multi-role holders. Per the PRD, operational roles
    // carry no approval authority, so these combinations raise no SoD flag and
    // need no justification — they demonstrate that AP+AR and Purchasing+Warehouse
    // are freely combinable.
    if (primary === "warehouse_staff" && idx % 11 === 3) roleKeys.push("purchasing_staff");
    if (primary === "ap_staff" && idx % 9 === 4) roleKeys.push("ar_staff");
    // The single generated Admin also holds Finance Manager — the one SOFT pair in
    // the PRD. A SOFT combination cannot be saved without a recorded justification,
    // so this seeded holder already carries one (mirrors the Admin's invite-time input).
    if (primary === "admin") {
      roleKeys.push("finance_manager");
      justification = "Owner-operator on a lean team holds both system administration and financial approval; every posting is reviewed during the monthly close.";
    }

    // Deterministic status spread: mostly Active, a few Invited / Inactive.
    let status = "Active";
    if (seq % 17 === 0) status = "Inactive";
    else if (seq % 13 === 0) status = "Invited";

    const approval_limit = roleKeys.includes("finance_manager") ? 100000000 : null;
    const lastActive = status === "Invited" ? null : `2026-${String(5 + (seq % 2)).padStart(2, "0")}-${String(1 + (seq % 27)).padStart(2, "0")}`;
    const invitedOn = status === "Invited"
      ? "2026-06-02"
      : `2025-${String(1 + (seq % 11)).padStart(2, "0")}-${String(1 + (seq % 26)).padStart(2, "0")}`;

    return { id: `U${String(seq).padStart(3, "0")}`, name, email, roleKeys, status, approval_limit, lastActive, invitedOn, justification };
  });
}

export const USERS = [...ANCHOR_USERS, ...buildGeneratedUsers()];
