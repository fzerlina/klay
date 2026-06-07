import { useMemo, useRef, useState } from "react";
import "./modules.css";
import "./invoices-ledger.css";
import "./settings-pages.css";
import "./roles-users.css";
import {
  ROLES,
  MODULES,
  LEVELS,
  PERMISSION_MATRIX,
  evaluateSod,
  USERS as SEED_USERS,
} from "../data/seed/roles";

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
}

function roleName(key) {
  return ROLES.find((r) => r.key === key)?.name || key;
}

// Highest approval limit across a user's roles (null = none).
function limitFor(roleKeys) {
  let max = null;
  for (const k of roleKeys) {
    const r = ROLES.find((x) => x.key === k);
    if (r?.approval_limit != null) max = Math.max(max ?? 0, r.approval_limit);
  }
  return max;
}

function fmtLimit(n) {
  if (n == null) return "—";
  return "Rp " + n.toLocaleString("id-ID");
}

const STATUS_LABELS = { Active: "Active", Invited: "Invited", Inactive: "Inactive" };

function StatusBadge({ status }) {
  const cls = status === "Active" ? "active" : status === "Invited" ? "invited" : "inactive";
  return <span className={`ru-status ${cls}`}>{STATUS_LABELS[status]}</span>;
}

// ── Invite / Change-role drawer with live SoD + account actions ──────────
function UserDrawer({ open, mode, user, onClose, onSave, onAction }) {
  const isInvite = mode === "invite";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKeys, setRoleKeys] = useState([]);
  const [justification, setJustification] = useState("");

  const lastKeyRef = useRef(null);
  if (open) {
    const key = isInvite ? "invite" : user?.id || "edit";
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      setName(isInvite ? "" : user?.name || "");
      setEmail(isInvite ? "" : user?.email || "");
      setRoleKeys(isInvite ? [] : [...(user?.roleKeys || [])]);
      setJustification(isInvite ? "" : user?.justification || "");
    }
  } else if (lastKeyRef.current !== null) {
    lastKeyRef.current = null;
  }

  const sod = useMemo(() => evaluateSod(roleKeys), [roleKeys]);

  if (!open) return null;

  const toggleRole = (key) => {
    setRoleKeys((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
    setJustification("");
  };

  const limit = limitFor(roleKeys);
  const baseValid = roleKeys.length > 0 && (!isInvite || (name.trim() && /\S+@\S+\.\S+/.test(email)));
  const blockedHard = sod.level === "hard";
  const needsJust = sod.level === "soft";
  const canSave = baseValid && !blockedHard && (!needsJust || justification.trim().length >= 8);

  function handleSave() {
    if (!canSave) return;
    onSave({
      mode,
      id: user?.id,
      name: name.trim(),
      email: email.trim(),
      roleKeys,
      approval_limit: limit,
      justification: needsJust ? justification.trim() : null,
    });
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div className="drawer-av" style={{ background: "var(--color-action)" }}>
            {isInvite ? "+" : initials(name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer-title">{isInvite ? "Invite user" : name || "(no name)"}</div>
            <div className="drawer-sub">{isInvite ? "Send an invitation & assign roles" : "Change user roles"}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          {isInvite && (
            <div className="ba-section">
              <div className="ba-section-title">User details</div>
              <div className="ba-field">
                <label>Full name <span className="ba-req">*</span></label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Andi Wijaya" />
              </div>
              <div className="ba-field">
                <label>Email <span className="ba-req">*</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@klay.id" />
              </div>
            </div>
          )}

          <div className="ba-section">
            <div className="ba-section-title">Roles <span className="ba-req">*</span></div>
            <p className="ba-help" style={{ marginBottom: 10 }}>
              Select one or more roles. Segregation of duties is checked live.
            </p>
            <div className="ru-role-checks">
              {ROLES.map((r) => {
                const on = roleKeys.includes(r.key);
                return (
                  <label key={r.key} className={`ru-role-check${on ? " on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleRole(r.key)} />
                    <span className="ru-role-check-box">
                      <svg viewBox="0 0 12 12"><polyline points="2 6.5 5 9 10 3" /></svg>
                    </span>
                    <span className="ru-role-check-body">
                      <span className="ru-role-check-name">
                        <span className={`ru-role-dot ${r.control_role ? "control" : "op"}`} />
                        {r.name}
                      </span>
                      <span className="ru-role-check-desc">{r.control_role ? "Control role" : "Operational role"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Live SoD feedback */}
          {sod.level === "hard" && (
            <div className="ru-sod-banner hard">
              <div className="ru-sod-banner-hdr">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
                Segregation of duties conflict — blocked
              </div>
              <p>{sod.message}</p>
              <p className="ru-sod-banner-note">This combination cannot be saved. Remove one of the conflicting roles.</p>
            </div>
          )}
          {sod.level === "soft" && (
            <div className="ru-sod-banner soft">
              <div className="ru-sod-banner-hdr">
                <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
                Segregation of duties warning
              </div>
              <p>{sod.message}</p>
              <div className="ba-field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Justification <span className="ba-req">*</span></label>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why this combination is needed (e.g. small team, manager oversight)…"
                />
                <span className="ba-help">At least 8 characters. The justification is recorded for the audit trail.</span>
              </div>
            </div>
          )}

          {roleKeys.length > 0 && (
            <div className="ba-section">
              <div className="ba-section-title">Summary</div>
              <div className="drawer-row">
                <span className="drawer-label">Roles</span>
                <span className="drawer-value">{roleKeys.map(roleName).join(", ")}</span>
              </div>
              <div className="drawer-row">
                <span className="drawer-label">Approval limit</span>
                <span className="drawer-value">{fmtLimit(limit)}</span>
              </div>
            </div>
          )}

          {!isInvite && user && (
            <div className="ba-section">
              <div className="ba-section-title">Account</div>
              <div className="drawer-row">
                <span className="drawer-label">Status</span>
                <span className="drawer-value"><StatusBadge status={user.status} /></span>
              </div>
              <div className="ru-acct-actions">
                {user.status === "Invited" && (
                  <button type="button" className="ru-acct-btn" onClick={() => onAction("resend", user)}>
                    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Resend invitation
                  </button>
                )}
                {user.status !== "Inactive" ? (
                  <button type="button" className="ru-acct-btn danger" onClick={() => { onAction("deactivate", user); onClose(); }}>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    Deactivate user
                  </button>
                ) : (
                  <button type="button" className="ru-acct-btn" onClick={() => { onAction("reactivate", user); onClose(); }}>
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    Reactivate user
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button className="drawer-btn ghost" onClick={onClose}>Cancel</button>
          <button className="drawer-btn primary" disabled={!canSave} onClick={handleSave}>
            {isInvite ? "Send invitation" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Read-only role detail drawer (opened from a role chip) ───────────────
// Roles are seeded constants in MVP (no custom-role builder until v2), so this
// surfaces a role's definition on demand instead of as its own nav page.
function RoleDetailDrawer({ roleKey, userCount, onClose }) {
  if (!roleKey) return null;
  const role = ROLES.find((r) => r.key === roleKey);
  if (!role) return null;

  const perms = PERMISSION_MATRIX[role.key] || {};

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div
            className="drawer-av"
            style={{ background: role.control_role ? "var(--color-action)" : "var(--color-text-tertiary)" }}
          >
            <span className={`ru-role-dot ${role.control_role ? "control" : "op"}`} style={{ width: 14, height: 14 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer-title">{role.name}</div>
            <div className="drawer-sub">
              {role.control_role ? "Control role" : "Operational role"}
              {role.is_system && " · System (built-in)"}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <div className="ba-section">
            <p className="ba-help" style={{ margin: 0 }}>{role.description}</p>
          </div>

          <div className="ba-section">
            <div className="ba-section-title">At a glance</div>
            <div className="drawer-row">
              <span className="drawer-label">Users holding this role</span>
              <span className="drawer-value">{userCount}</span>
            </div>
            <div className="drawer-row">
              <span className="drawer-label">Approval limit</span>
              <span className="drawer-value">{fmtLimit(role.approval_limit)}</span>
            </div>
            <div className="drawer-row">
              <span className="drawer-label">Type</span>
              <span className="drawer-value">{role.is_system ? "System role — cannot be deleted" : "Custom role"}</span>
            </div>
          </div>

          <div className="ba-section">
            <div className="ba-section-title">Module permissions</div>
            <div className="rd-perm-list">
              {MODULES.map((m) => {
                const lvl = perms[m.key] || "none";
                return (
                  <div key={m.key} className="rd-perm-row">
                    <span className="rd-perm-mod">{m.label}</span>
                    <span className={`ru-lvl ru-lvl-${lvl.replace("+", "")}`}>{LEVELS[lvl].label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <button className="drawer-btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState(() => SEED_USERS.map((u) => ({ ...u, roleKeys: [...u.roleKeys] })));
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all"); // all | has | none
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(null); // { mode, user }
  const [roleDrawer, setRoleDrawer] = useState(null); // roleKey (read-only detail)
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  // Active+invited users holding each role (drives the role-detail count).
  const roleCounts = useMemo(() => {
    const counts = {};
    for (const r of ROLES) counts[r.key] = 0;
    for (const u of users) {
      if (u.status === "Inactive") continue;
      for (const k of u.roleKeys) if (counts[k] != null) counts[k] += 1;
    }
    return counts;
  }, [users]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 2200);
  }

  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "Active").length;
    const invited = users.filter((u) => u.status === "Invited").length;
    const inactive = users.filter((u) => u.status === "Inactive").length;
    return { all: users.length, active, invited, inactive };
  }, [users]);

  // Role tabs (All + one per role). Counts span every user holding the role.
  const roleTabs = useMemo(() => [
    { k: "all", lbl: "All", count: users.length },
    ...ROLES.map((r) => ({
      k: r.key,
      lbl: r.name,
      count: users.filter((u) => u.roleKeys.includes(r.key)).length,
    })),
  ], [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (roleFilter !== "all" && !u.roleKeys.includes(roleFilter)) return false;
      if (approvalFilter === "has" && u.approval_limit == null) return false;
      if (approvalFilter === "none" && u.approval_limit != null) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roleKeys.some((k) => roleName(k).toLowerCase().includes(q))
      );
    });
  }, [users, statusFilter, roleFilter, approvalFilter, search]);

  function handleRowAction(action, user) {
    if (action === "deactivate") {
      setUsers((cur) => cur.map((u) => (u.id === user.id ? { ...u, status: "Inactive" } : u)));
      showToast(`${user.name} deactivated.`);
      return;
    }
    if (action === "reactivate") {
      setUsers((cur) => cur.map((u) => (u.id === user.id ? { ...u, status: "Active" } : u)));
      showToast(`${user.name} reactivated.`);
      return;
    }
    if (action === "resend") { showToast(`Invitation resent to ${user.email}.`); return; }
  }

  function handleSave(data) {
    if (data.mode === "invite") {
      const id = `U${String(Date.now()).slice(-6)}`;
      setUsers((cur) => [
        { id, name: data.name, email: data.email, roleKeys: data.roleKeys, status: "Invited", approval_limit: data.approval_limit, lastActive: null, invitedOn: "2026-06-07", justification: data.justification },
        ...cur,
      ]);
      showToast(`Invitation sent to ${data.email}.`);
    } else {
      setUsers((cur) => cur.map((u) => (u.id === data.id ? { ...u, roleKeys: data.roleKeys, approval_limit: data.approval_limit, justification: data.justification } : u)));
      showToast(data.justification ? "Roles updated with justification recorded." : "Roles updated.");
    }
    setDrawer(null);
  }

  return (
    <div className="lg-page users-page">
      <div className="lg-scroll-container">
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Users</h1>
              <p className="settings-sub">
                Manage who has access and which roles they hold. Role assignments are checked against the
                segregation-of-duties rules — click any role chip to see that role's definition and permissions.
              </p>
            </div>
            <div className="lg-head-actions">
              <button type="button" className="lg-btn-brand" onClick={() => setDrawer({ mode: "invite" })}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Invite user
              </button>
            </div>
          </div>

          <div className="lg-kpi-strip kpi-3">
            <button type="button" className="lg-kpi-cell" onClick={() => setStatusFilter("all")}>
              <div className="lg-kpi-lbl">Total users</div>
              <div className="lg-kpi-val">{stats.all}</div>
              <div className="lg-kpi-sub">{stats.active} active</div>
            </button>
            <button type="button" className="lg-kpi-cell" onClick={() => setStatusFilter("Invited")}>
              <div className="lg-kpi-lbl">Invited</div>
              <div className="lg-kpi-val">{stats.invited}</div>
              <div className="lg-kpi-sub">awaiting acceptance</div>
            </button>
            <button type="button" className="lg-kpi-cell" onClick={() => setStatusFilter("Inactive")}>
              <div className="lg-kpi-lbl">Inactive</div>
              <div className="lg-kpi-val">{stats.inactive}</div>
              <div className="lg-kpi-sub">access revoked</div>
            </button>
          </div>
        </div>

        <div className="lg-table-wrap">
          <div className="lg-card lg-table-users">
            <div className="bp-tabs-row">
              {roleTabs.map((t) => (
                <button
                  key={t.k}
                  type="button"
                  className={`bp-tab${roleFilter === t.k ? " active" : ""}`}
                  onClick={() => setRoleFilter(t.k)}
                >
                  {t.lbl}
                  <span className="bp-tab-count">{t.count}</span>
                </button>
              ))}
            </div>

            <div className="lg-filter-row">
              <div className="lg-search">
                <svg viewBox="0 0 14 14"><circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3" strokeLinecap="round"/></svg>
                <input
                  type="text"
                  placeholder="Search name, email, or role…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="ru-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">Any status</option>
                <option value="Active">Active</option>
                <option value="Invited">Invited</option>
                <option value="Inactive">Inactive</option>
              </select>
              <select
                className="ru-filter-select"
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                aria-label="Filter by approval authority"
              >
                <option value="all">Any approval authority</option>
                <option value="has">Has approval limit</option>
                <option value="none">No approval limit</option>
              </select>
              {(statusFilter !== "all" || approvalFilter !== "all") && (
                <button
                  type="button"
                  className="ru-filter-clear"
                  onClick={() => { setStatusFilter("all"); setApprovalFilter("all"); }}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="lg-col-header ru-users-cols">
              <div>User</div>
              <div>Roles</div>
              <div>Status</div>
              <div style={{ textAlign: "right" }}>Approval limit</div>
            </div>

            {filtered.length === 0 && <div className="lg-empty">No users in this view.</div>}

            {filtered.map((u, i) => {
              const sod = u.status !== "Inactive" ? evaluateSod(u.roleKeys) : { level: "none" };
              return (
                <div
                  key={u.id}
                  className={`lg-row ru-users-cols${i % 2 === 1 ? " alt" : ""}`}
                  onClick={() => setDrawer({ mode: "edit", user: u })}
                >
                  <div className="ru-user-cell">
                    <span className="ru-user-av">{initials(u.name)}</span>
                    <span className="ru-user-id">
                      <span className="ru-user-name">{u.name}</span>
                      <span className="ru-user-email">{u.email}</span>
                    </span>
                  </div>
                  <div className="ru-user-roles">
                    {u.roleKeys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="ru-role-chip ru-role-chip-btn"
                        title={`View ${roleName(k)} definition`}
                        onClick={(e) => { e.stopPropagation(); setRoleDrawer(k); }}
                      >
                        {roleName(k)}
                      </button>
                    ))}
                    {sod.level !== "none" && (
                      <span
                        className={`ru-sod-ico ${sod.level}`}
                        title={u.justification ? `${sod.message}\nJustification: ${u.justification}` : sod.message}
                        aria-label="Segregation of duties warning"
                      >
                        <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </span>
                    )}
                  </div>
                  <div><StatusBadge status={u.status} /></div>
                  <div className="lg-cell-total">
                    {u.approval_limit != null
                      ? <><span className="lg-cell-total-rp">Rp</span>{u.approval_limit.toLocaleString("id-ID")}</>
                      : <span className="lg-cell-em-dash">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <UserDrawer
        open={!!drawer}
        mode={drawer?.mode || "invite"}
        user={drawer?.user || null}
        onClose={() => setDrawer(null)}
        onSave={handleSave}
        onAction={handleRowAction}
      />

      <RoleDetailDrawer
        roleKey={roleDrawer}
        userCount={roleDrawer ? roleCounts[roleDrawer] ?? 0 : 0}
        onClose={() => setRoleDrawer(null)}
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
