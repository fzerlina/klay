import { useState, useMemo } from "react";
import { KLAY_COA_TREE } from "../data/klayData";

// ── helpers ─────────────────────────────────────────────────────
const TYPE_CLS = {
  Asset:     "asset",
  Liability: "liability",
  Equity:    "equity",
  Revenue:   "revenue",
  Expense:   "expense",
};

function TypeBadge({ type }) {
  const cls = TYPE_CLS[type] || "asset";
  return <span className={`type-badge-coa ${cls}`}>{type}</span>;
}

function Toggle({ on, onChange }) {
  return (
    <span
      className={`toggle-sw ${on ? "on" : "off"}`}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      title={on ? "Active" : "Inactive"}
    />
  );
}

// Build an id → node map for ancestor lookups
const TREE_MAP = Object.fromEntries(KLAY_COA_TREE.map((n) => [n.id, n]));

// Count direct account descendants of a group (all levels below it)
function countAccounts(groupId) {
  let n = 0;
  for (const node of KLAY_COA_TREE) {
    if (!node.code) continue; // skip groups
    // walk parent chain
    let cur = node;
    while (cur.parent) {
      if (cur.parent === groupId) { n++; break; }
      cur = TREE_MAP[cur.parent];
      if (!cur) break;
    }
  }
  return n;
}

// Indent class by level
function levelCls(level) {
  return `coa-l${Math.min(level, 4)}`;
}

// ── FS Mapping tab ───────────────────────────────────────────────
const FS_GROUPS = [
  {
    label: "Balance Sheet",
    rows: [
      { code: "1-1000", name: "Cash & Equivalents",      stmt: "Balance Sheet", line: "Cash and cash equivalents",     sec: "Current assets" },
      { code: "1-1100", name: "— Cash on Hand",          stmt: "Balance Sheet", line: "Cash and cash equivalents",     sec: "Current assets", indent: true },
      { code: "1-1200", name: "— Bank Accounts",         stmt: "Balance Sheet", line: "Cash and cash equivalents",     sec: "Current assets", indent: true },
      { code: "1-2000", name: "Trade Receivables",       stmt: "Balance Sheet", line: "Trade receivables",             sec: "Current assets" },
      { code: "1-3000", name: "Inventories",             stmt: "Balance Sheet", line: "Inventories",                   sec: "Current assets" },
      { code: "1-4000", name: "Prepaid Expenses",        stmt: "Balance Sheet", line: "Prepaid & other current assets",sec: "Current assets" },
      { code: "1-5000", name: "Property, Plant & Equip.", stmt: "Balance Sheet", line: "Property, plant & equipment",  sec: "Non-current assets" },
      { code: "2-1000", name: "Trade Payables",          stmt: "Balance Sheet", line: "Trade payables",                sec: "Current liabilities" },
      { code: "2-2000", name: "Tax Payables",            stmt: "Balance Sheet", line: "Tax payables",                  sec: "Current liabilities" },
      { code: "2-6000", name: "Long-term Bank Loans",    stmt: "Balance Sheet", line: "Bank loans",                    sec: "Non-current liabilities" },
      { code: "3-1000", name: "Paid-in Capital",         stmt: "Balance Sheet", line: "Paid-in capital",               sec: "Equity" },
      { code: "3-2000", name: "Retained Earnings",       stmt: "Balance Sheet", line: "Retained earnings",             sec: "Equity" },
    ],
  },
  {
    label: "Profit & Loss",
    rows: [
      { code: "4-1000", name: "Operating Revenue",       stmt: "P&L", line: "Revenue",                sec: "Revenue" },
      { code: "4-1100", name: "— Sales Furniture",       stmt: "P&L", line: "Revenue",                sec: "Revenue", indent: true },
      { code: "4-1200", name: "— Sales Textile",         stmt: "P&L", line: "Revenue",                sec: "Revenue", indent: true },
      { code: "5-1000", name: "Direct Materials",        stmt: "P&L", line: "Cost of goods sold",     sec: "COGS" },
      { code: "5-2000", name: "Direct Labour",           stmt: "P&L", line: "Cost of goods sold",     sec: "COGS" },
      { code: "6-2000", name: "Management Salaries",     stmt: "P&L", line: "Personnel expenses",     sec: "OpEx" },
      { code: "6-3000", name: "Office Rent",             stmt: "P&L", line: "General & admin",        sec: "OpEx" },
      { code: "7-1000", name: "Interest Expense",        stmt: "P&L", line: "Finance costs",          sec: "Other" },
      { code: "8-1000", name: "Current Income Tax",      stmt: "P&L", line: "Income tax expense",     sec: "Tax" },
    ],
  },
];

// ── main component ───────────────────────────────────────────────
export default function ChartOfAccountsPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(new Set());
  const [activeMap, setActiveMap] = useState(() => {
    const m = {};
    KLAY_COA_TREE.forEach((n) => { if (n.code) m[n.id] = n.active !== false; });
    return m;
  });

  const accountCount = KLAY_COA_TREE.filter((n) => n.code).length;

  function toggleGroup(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function expandAll() { setCollapsed(new Set()); }
  function collapseAll() {
    setCollapsed(new Set(KLAY_COA_TREE.filter((n) => !n.code).map((n) => n.id)));
  }

  function toggleActive(id) {
    setActiveMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // determine if a node is visible (none of its ancestor groups is collapsed)
  function isVisible(node) {
    let cur = node;
    while (cur.parent) {
      if (collapsed.has(cur.parent)) return false;
      cur = TREE_MAP[cur.parent];
      if (!cur) break;
    }
    return true;
  }

  const q = search.toLowerCase().trim();

  // rendered rows
  const rows = useMemo(() => {
    return KLAY_COA_TREE.map((node) => {
      const visible = isVisible(node);
      const searchMatch = q
        ? (node.code || "").toLowerCase().includes(q) || (node.name || node.label || "").toLowerCase().includes(q)
        : true;
      return { node, visible, searchMatch };
    });
  }, [collapsed, q]);

  const groupCounts = useMemo(() => {
    const m = {};
    KLAY_COA_TREE.filter((n) => !n.code).forEach((g) => { m[g.id] = countAccounts(g.id); });
    return m;
  }, []);

  return (
    <div className="coa-view">
      <div className="coa-scroll">

        {/* Page header */}
        <div className="page-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="page-title">Chart of Accounts</div>
            <div className="page-sub">{accountCount} accounts · PT Sejahtera Makmur</div>
          </div>
          <div className="head-actions">
            <button className="btn">
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: "currentColor", fill: "none", strokeWidth: 1.5 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import CSV
            </button>
            <button className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: "#fff", fill: "none", strokeWidth: 2.5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add account
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <div className={`tab${activeTab === "accounts" ? " active" : ""}`} onClick={() => setActiveTab("accounts")}>Accounts</div>
          <div className={`tab${activeTab === "fs" ? " active" : ""}`} onClick={() => setActiveTab("fs")}>FS mapping</div>
        </div>

        {/* ── ACCOUNTS TAB ── */}
        {activeTab === "accounts" && (
          <>
            <div className="toolbar">
              <div className="search-wrap">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search by code or name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="btn" style={{ height: 34, fontSize: 12 }} onClick={expandAll}>Expand all</button>
              <button className="btn" style={{ height: 34, fontSize: 12 }} onClick={collapseAll}>Collapse all</button>
            </div>

            <div className="coa-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 88 }}>Code</th>
                    <th>Account name</th>
                    <th style={{ width: 100 }}>Type</th>
                    <th style={{ width: 80 }}>FS</th>
                    <th style={{ width: 100 }}>Normal bal.</th>
                    <th style={{ width: 62 }}>Active</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ node, visible, searchMatch }) => {
                    // In search mode: show only accounts that match (ignore collapse)
                    if (q) {
                      if (node.code) {
                        if (!searchMatch) return null;
                        return (
                          <tr key={node.id} className="coa-match">
                            <td className="mono" style={{ paddingLeft: 14 + node.level * 14 }}>{node.code}</td>
                            <td style={{ fontWeight: 500 }}>{node.name}</td>
                            <td><TypeBadge type={node.type} /></td>
                            <td style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{node.fs}</td>
                            <td style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{node.bal}</td>
                            <td><Toggle on={activeMap[node.id]} onChange={() => toggleActive(node.id)} /></td>
                            <td><button className="row-action-btn">Edit</button></td>
                          </tr>
                        );
                      }
                      return null; // hide group headers during search
                    }

                    // Normal tree mode
                    if (!visible) return null;

                    // Group row
                    if (!node.code) {
                      const isOpen = !collapsed.has(node.id);
                      const cnt = groupCounts[node.id] || 0;
                      return (
                        <tr key={node.id} className={`coa-group-row coa-l${node.level}`} onClick={() => toggleGroup(node.id)}>
                          <td colSpan={7}>
                            <span className="tr-chevron" style={{ display: "inline-flex", alignItems: "center" }}>
                              <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: "var(--color-text-tertiary)", fill: "none", strokeWidth: 2.5, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                            </span>
                            {node.label}
                            <span className="tr-count">({cnt})</span>
                          </td>
                        </tr>
                      );
                    }

                    // Account row
                    return (
                      <tr key={node.id} className={levelCls(node.level)}>
                        <td className="mono">{node.code}</td>
                        <td style={{ fontWeight: node.level <= 2 ? 500 : 400, color: node.level > 2 ? "var(--color-text-secondary)" : undefined }}>
                          {node.level > 2 && <span style={{ color: "var(--color-text-tertiary)", marginRight: 4 }}>—</span>}
                          {node.name}
                        </td>
                        <td><TypeBadge type={node.type} /></td>
                        <td style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{node.fs}</td>
                        <td style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{node.bal}</td>
                        <td><Toggle on={activeMap[node.id] !== false} onChange={() => toggleActive(node.id)} /></td>
                        <td><button className="row-action-btn">Edit</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-tertiary)" }}>
              {q
                ? `${rows.filter((r) => r.node.code && r.searchMatch).length} accounts match "${search}"`
                : `${accountCount} accounts total`}
            </div>
          </>
        )}

        {/* ── FS MAPPING TAB ── */}
        {activeTab === "fs" && (
          <>
            <div className="toolbar">
              <div className="search-wrap">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="search-input" type="text" placeholder="Search accounts…" />
              </div>
              <select className="filter-select">
                <option>All statements</option>
                <option>P&L</option>
                <option>Balance Sheet</option>
              </select>
            </div>

            <div className="coa-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 88 }}>Code</th>
                    <th style={{ width: 220 }}>Account name</th>
                    <th style={{ width: 130 }}>Statement</th>
                    <th>Line item</th>
                    <th style={{ width: 130 }}>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {FS_GROUPS.map((grp) => (
                    <>
                      <tr key={grp.label} className="group-row">
                        <td colSpan={5}>{grp.label}</td>
                      </tr>
                      {grp.rows.map((row) => (
                        <tr key={row.code}>
                          <td className="mono" style={row.indent ? { paddingLeft: 28 } : undefined}>{row.code}</td>
                          <td style={row.indent ? { paddingLeft: 28, color: "var(--color-text-secondary)" } : undefined}>{row.name}</td>
                          <td className="cell-muted">{row.stmt}</td>
                          <td className="cell-muted">{row.line}</td>
                          <td className="cell-muted">{row.sec}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
