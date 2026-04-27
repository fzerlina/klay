import { useState } from "react";
import { NavLink } from "react-router-dom";

const navSections = [
  {
    section: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      },
    ],
  },
  {
    section: "Keuangan",
    items: [
      {
        label: "General Ledger",
        to: "/general-ledger",
        icon: <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
      },
      {
        label: "Journal Entry",
        to: "/journal-entry",
        icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
      },
      {
        label: "Bills",
        to: "/bills",
        icon: <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
      },
      {
        label: "Invoices",
        to: "/invoices",
        icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      },
    ],
  },
  {
    section: "Operasional",
    items: [
      {
        label: "Vendors",
        to: "/vendors",
        icon: <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      },
      {
        label: "Customers",
        to: "/customers",
        icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
      },
    ],
  },
  {
    section: "Laporan",
    items: [
      {
        label: "Trial Balance",
        to: "/trial-balance",
        icon: <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      },
      {
        label: "P&L",
        to: "/pl",
        icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
      },
    ],
  },
];

const settingsSections = [
  {
    key: "accounting",
    label: "Accounting",
    icon: <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
    items: [
      { label: "Chart of accounts", to: "/chart-of-accounts" },
      { label: "Dimensions", to: "/dimensions" },
      { label: "Fiscal year" },
      { label: "Currency" },
    ],
  },
  {
    key: "tax",
    label: "Tax",
    icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
    items: [
      { label: "Tax codes" },
      { label: "Tax rates" },
    ],
  },
  {
    key: "access",
    label: "Access",
    icon: <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    items: [
      { label: "Roles" },
      { label: "Users" },
    ],
  },
  {
    key: "integration",
    label: "Integration",
    icon: <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    items: [
      { label: "Bank feed" },
      { label: "Document inbox" },
    ],
  },
];

export default function Sidebar() {
  const [open, setOpen] = useState({});
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <nav className="sb">
      <div className="sb-top">
        <div className="sb-logomark">
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: "#fff" }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="sb-brand">Klay</span>
      </div>

      <div className="sb-search-wrap">
        <div className="sb-search">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Cari menu, jurnal..." />
        </div>
        <button className="sb-notif-btn" type="button">
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="sb-notif-dot" />
        </button>
      </div>

      {navSections.map(({ section, items }) => (
        <div key={section}>
          <div className="sb-section">{section}</div>
          {items.map(({ label, to, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sb-item${isActive ? " active" : ""}`}
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </div>
      ))}

      <div className="sb-section">Settings</div>
      {settingsSections.map(({ key, label, icon, items }) => (
        <div key={key}>
          <div className="sn-item" onClick={() => toggle(key)}>
            {icon}
            {label}
            <svg
              className="sn-arrow"
              viewBox="0 0 24 24"
              style={{ transform: open[key] ? "rotate(90deg)" : "none" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          {open[key] && (
            <div>
              {items.map((item) =>
                item.to ? (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `sn-subitem${isActive ? " sn-subitem-active" : ""}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <div key={item.label} className="sn-subitem">
                    {item.label}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}

      <div className="sb-bottom">
        <div className="sb-profile">
          <div className="sb-av">SW</div>
          <div>
            <div className="sb-profile-name">Sarah Wijaya</div>
            <div className="sb-profile-role">PT Sejahtera Makmur</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
