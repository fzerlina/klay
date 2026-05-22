import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";

// Mini progress ring shown next to the Close menu item. Reinforces Klay's
// 0-day closing USP — the user can see close health without leaving any page.
function CloseProgressRing({ done = 5, awaiting = 3, working = 0, total = 8 }) {
  const R = 7;
  const C = 2 * Math.PI * R;
  const doneLen     = total ? (done     / total) * C : 0;
  const awaitingLen = total ? (awaiting / total) * C : 0;
  const workingLen  = total ? (working  / total) * C : 0;
  const overall = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="sb-progress-ring" aria-label={`Close: ${done} of ${total} complete (${overall}%)`} title={`${done}/${total} complete · ${awaiting} awaiting · ${working} in progress`}>
      <svg viewBox="0 0 20 20">
        <circle cx="10" cy="10" r={R} fill="none" style={{ stroke: "rgba(255,255,255,0.18)" }} strokeWidth="2.4"/>
        {done > 0 && (
          <circle cx="10" cy="10" r={R} fill="none" style={{ stroke: "#3ec47a" }} strokeWidth="2.4"
            strokeDasharray={`${doneLen} ${C - doneLen}`}
            transform="rotate(-90 10 10)" strokeLinecap="round"/>
        )}
        {awaiting > 0 && (
          <circle cx="10" cy="10" r={R} fill="none" style={{ stroke: "var(--color-brand)" }} strokeWidth="2.4"
            strokeDasharray={`${awaitingLen} ${C - awaitingLen}`}
            strokeDashoffset={-doneLen}
            transform="rotate(-90 10 10)" strokeLinecap="round"/>
        )}
        {working > 0 && (
          <circle cx="10" cy="10" r={R} fill="none" style={{ stroke: "rgba(255,255,255,0.45)" }} strokeWidth="2.4"
            strokeDasharray={`${workingLen} ${C - workingLen}`}
            strokeDashoffset={-(doneLen + awaitingLen)}
            transform="rotate(-90 10 10)" strokeLinecap="round"/>
        )}
      </svg>
    </span>
  );
}

const navSections = [
  {
    section: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      },
      {
        label: "Close April 2025",
        to: "/close",
        icon: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="14" x2="13" y2="18"/><line x1="13" y1="14" x2="9" y2="18"/></svg>,
        indicator: <CloseProgressRing />,
      },
    ],
  },
  {
    section: "Finance",
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
      {
        label: "Bank Reconciliation",
        to: "/bank-reconciliation",
        icon: <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 15h4M14 15h4"/></svg>,
      },
    ],
  },
  {
    section: "Operations",
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
    section: "Reports",
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
      { label: "Bank accounts", to: "/bank-accounts" },
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

// Brand-textured background — gradient (on .sb), film grain, soft vignette,
// architectural light shapes. Pure decoration; aria-hidden, pointer-events:none.
function BrandTexture() {
  const noiseSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>" +
      "<filter id='n'>" +
        "<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
      "</filter>" +
      "<rect width='100%' height='100%' filter='url(#n)'/>" +
    "</svg>";
  const noiseUrl = `url("data:image/svg+xml,${encodeURIComponent(noiseSvg)}")`;
  return (
    <div className="sb-texture" aria-hidden>
      <div className="sb-grain" style={{ backgroundImage: noiseUrl }} />
      <div className="sb-vignette" />
      <svg className="sb-shapes" viewBox="0 0 232 600" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sb-slat" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.16)" />
          </linearGradient>
        </defs>
        <g>
          <rect x="-40" y="80"  width="340" height="540" fill="url(#sb-slat)" opacity="0.6" />
          <rect x="10"  y="130" width="290" height="490" fill="url(#sb-slat)" opacity="0.6" />
          <rect x="60"  y="180" width="240" height="440" fill="url(#sb-slat)" opacity="0.6" />
          <rect x="110" y="230" width="190" height="390" fill="url(#sb-slat)" opacity="0.6" />
          <rect x="160" y="280" width="140" height="340" fill="url(#sb-slat)" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}

function CollapseToggle({ collapsed, onToggle }) {
  const label = collapsed ? "Open sidebar" : "Close sidebar";
  return (
    <button
      type="button"
      className="sb-toggle"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={collapsed}
    >
      <svg viewBox="0 0 12 12">
        <path d={collapsed ? "M4 2l4 4-4 4" : "M8 2l-4 4 4 4"} />
      </svg>
    </button>
  );
}

const STORAGE_KEY = "klay.sidebar.collapsed";

function readInitialCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === "true";
  } catch (_) {}
  return window.innerWidth < 1280;
}

export default function Sidebar() {
  const [open, setOpen] = useState({});
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch (_) {}
  }, [collapsed]);

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <nav className={`sb${collapsed ? " collapsed" : ""}`}>
      <BrandTexture />
      <CollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="sb-content">
        <div className="sb-top">
          <div className="sb-logomark">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="sb-brand">Klay</span>
        </div>

        <div className="sb-search-wrap">
          <button
            type="button"
            className="sb-klay-btn"
            title="Ask Klay (⌘J)"
            onClick={() => window.dispatchEvent(new CustomEvent("klay:open-launcher"))}
          >
            <span className="sb-klay-btn-icon">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
                <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
              </svg>
            </span>
            <span className="sb-klay-btn-label">Ask Klay</span>
            <span className="sb-klay-btn-kbd">⌘J</span>
          </button>
          <button className="sb-notif-btn" type="button" title="Notifications">
            <svg viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="sb-notif-dot" />
          </button>
        </div>

        {navSections.map(({ section, items }, sIdx) => (
          <div key={section}>
            <div className="sb-section">{section}</div>
            {sIdx > 0 && <div className="sb-rail-divider" />}
            {items.map(({ label, to, icon, indicator }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? `${section} · ${label}` : undefined}
                className={({ isActive }) => `sb-item${isActive ? " active" : ""}`}
              >
                {icon}
                {!collapsed && label}
                {!collapsed && indicator}
              </NavLink>
            ))}
          </div>
        ))}

        {!collapsed && (
          <>
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
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <div className="sb-bottom">
          <div className="sb-profile" title={collapsed ? "Sarah Wijaya · PT Sejahtera Makmur" : undefined}>
            <div className="sb-av">SW</div>
            {!collapsed && (
              <div>
                <div className="sb-profile-name">Sarah Wijaya</div>
                <div className="sb-profile-role">PT Sejahtera Makmur</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
