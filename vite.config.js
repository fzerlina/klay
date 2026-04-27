import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function buildPrototypePage(html, initialView) {
  const withLayoutFix = html.replace(
    "</style>",
    `
/* Cursor hotfix: Dimensions left spacing alignment */
#view-coa,
#view-dim{
  width:100% !important;
  flex:1 1 auto !important;
}
#view-coa.active,
#view-dim.active{
  display:flex !important;
  flex-direction:column !important;
}
#view-coa .settings-content,
#view-dim .settings-content{
  width:100% !important;
  max-width:none !important;
  margin:0 !important;
  padding:28px 32px 48px !important;
}
/* Enforce Klay typography (no Manrope) */
:root{
  --font-sans:'Instrument Sans',sans-serif;
  --font-mono:'Inconsolata',monospace;
}
body{font-family:var(--font-sans);}
/* Global shell consistency — sidebar + topbar handled by React shell */
.sb{display:none !important;}
.topbar{display:none !important;}
.tb-right,.tb-org{display:none !important;}
/* Sidebar search + notif */
.sb-search-wrap{padding:10px 10px 6px;display:flex;align-items:center;gap:8px;flex-shrink:0;}
.sb-search{display:flex;align-items:center;gap:7px;background:var(--color-surface-sunken);border:1px solid var(--color-border-default);border-radius:var(--radius-md);padding:6px 9px;cursor:text;transition:border-color var(--transition-fast);flex:1;}
.sb-search svg{width:12px;height:12px;stroke:var(--color-text-tertiary);fill:none;stroke-width:1.5;flex-shrink:0;}
.sb-search input{border:none;outline:none;font-family:var(--font-sans);font-size:12px;color:var(--color-text-primary);background:transparent;width:100%;min-width:0;}
.sb-search input::placeholder{color:var(--color-text-tertiary);}
.sb-notif-btn{width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-border-default);background:var(--color-surface-raised);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;flex-shrink:0;}
.sb-notif-btn svg{width:14px;height:14px;stroke:var(--color-text-tertiary);fill:none;stroke-width:1.5;}
.sb-notif-dot{position:absolute;top:6px;right:6px;width:5px;height:5px;background:var(--color-brand);border-radius:50%;border:1.5px solid #fff;}
</style>`,
  );

  return withLayoutFix.replace(
    "</body>",
    `
<script>
  (function() {
    const map = { gl: "/general-ledger", je: "/journal-entry", coa: "/chart-of-accounts", dim: "/dimensions" };
    const initialView = "${initialView}";
    const originalShowView = window.showView;
    window.showView = function(view) {
      const target = map[view];
      if (target && window.top && window.top !== window) {
        window.top.location.pathname = target;
        return;
      }
      if (typeof originalShowView === "function") originalShowView(view);
    };
    document.querySelectorAll(".sb-item,.sn-subitem").forEach((el) => {
      const label = (el.textContent || "").trim().toLowerCase();
      const routeMap = {
        "general ledger": "/general-ledger",
        "journal entry": "/journal-entry",
        "chart of accounts": "/chart-of-accounts",
        "chart of accounts ": "/chart-of-accounts",
        dimensions: "/dimensions",
      };
      const target = routeMap[label];
      if (!target) return;
      el.addEventListener("click", (event) => {
        event.preventDefault();
        if (window.top && window.top !== window) {
          window.top.location.pathname = target;
        } else {
          window.location.pathname = target;
        }
      });
    });
    const sbTop = document.querySelector(".sb-top");
    if (sbTop) {
      let wrap = document.querySelector(".sb-search-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "sb-search-wrap";
        wrap.innerHTML = '<div class="sb-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" placeholder="Cari menu, jurnal..."></div>';
        sbTop.insertAdjacentElement("afterend", wrap);
      }
      if (!wrap.querySelector(".sb-notif-btn")) {
        const notif = document.createElement("button");
        notif.className = "sb-notif-btn";
        notif.type = "button";
        notif.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><span class="sb-notif-dot"></span>';
        wrap.appendChild(notif);
      }
    }
    if (typeof originalShowView === "function") originalShowView(initialView);
  })();
</script>
</body>`,
  );
}

function buildGlPage(html) {
  const withFontFix = html.replace(
    "</style>",
    `
/* Enforce Klay typography (no Manrope) */
:root{
  --font-sans:'Instrument Sans',sans-serif;
  --font-mono:'Inconsolata',monospace;
}
body{font-family:var(--font-sans);}
/* Global shell consistency — sidebar + topbar handled by React shell */
.sb{display:none !important;}
.topbar{display:none !important;}
.tb-right,.tb-org{display:none !important;}
/* GL command center should be neutral like JE */
.cc-band{
  background:var(--color-surface-raised) !important;
  border-bottom:1px solid var(--color-border-default) !important;
}
.m-arr{
  background:var(--color-surface-sunken) !important;
  border:1px solid var(--color-border-default) !important;
  color:var(--color-text-secondary) !important;
}
.m-label{color:var(--color-text-primary) !important;}
.btn-cc-export{
  background:var(--color-surface-raised) !important;
  border:1px solid var(--color-border-default) !important;
  color:var(--color-text-secondary) !important;
}
.btn-cc-je{
  background:var(--color-surface-deep) !important;
  color:#fff !important;
}
.cc-bubble{display:none !important;}
/* Tiles: neutral background matching JE */
.cc-tile.ct-red,.cc-tile.ct-amber,.cc-tile.ct-blue,.cc-tile.ct-dark{
  background:var(--color-surface-sunken) !important;
  border-color:var(--color-border-default) !important;
}
.cc-tile:hover{background:#EDEBE6 !important;border-color:#C8C2BA !important;}
/* Tile text colors for light backgrounds */
.ct-title{color:var(--color-text-primary) !important;}
.ct-desc{color:var(--color-text-tertiary) !important;}
.ctc-r{color:var(--danger-text,#A02020) !important;}
.ctc-a{color:var(--warning-text,#7A4D00) !important;}
.ctc-b{color:var(--color-action,#1A46C8) !important;}
.ctc-g{color:#166638 !important;}
.ctcta-r{color:var(--danger-text,#A02020) !important;}
.ctcta-a{color:var(--warning-text,#7A4D00) !important;}
.ctcta-b{color:var(--color-action,#1A46C8) !important;}
.ctcta-g{color:#166638 !important;}
.cc-acct-count{color:var(--color-text-tertiary) !important;}
/* Saldo block: fix white-on-white from dark-background design */
.saldo-num{color:var(--color-text-primary) !important;}
.saldo-lbl{color:var(--color-text-tertiary) !important;}
.closing-track{background:var(--color-border-default) !important;}
.closing-fill{background:var(--color-action) !important;}
.closing-lbl{color:var(--color-text-tertiary) !important;}
.closing-pct{color:var(--color-action) !important;}
/* cc-div divider */
.cc-div{background:var(--color-border-default) !important;}
/* Expand toggle */
.cc-expand{border-top-color:var(--color-border-default) !important;}
.cc-exp-lbl{color:var(--color-text-tertiary) !important;}
.cc-expand:hover .cc-exp-lbl{color:var(--color-text-primary) !important;}
.cc-exp-icon{color:var(--color-text-tertiary) !important;}
/* Expanded area labels */
.exp-col-label{color:var(--color-text-tertiary) !important;}
/* Checklist items */
.cl-item{border-bottom-color:var(--color-border-default) !important;}
.cl-title{color:var(--color-text-primary) !important;}
.cl-sub{color:var(--color-text-tertiary) !important;}
.ci-ok{background:var(--success-surface) !important;border-color:var(--success-border) !important;color:var(--success-text) !important;}
.ci-warn{background:var(--warning-surface) !important;border-color:var(--warning-border) !important;color:var(--warning-text) !important;}
.ci-bad{background:var(--danger-surface) !important;border-color:var(--danger-border) !important;color:var(--danger-text) !important;}
.cl-cta-ok{color:var(--success-text) !important;border-color:var(--success-border) !important;}
.cl-cta-warn{color:var(--warning-text) !important;border-color:var(--warning-border) !important;}
.cl-cta-bad{color:var(--danger-text) !important;border-color:var(--danger-border) !important;}
.cl-cta-dim{color:var(--color-text-tertiary) !important;border-color:var(--color-border-default) !important;}
/* AI log */
.al-item{border-bottom-color:var(--color-border-default) !important;}
.al-text{color:var(--color-text-secondary) !important;}
.al-time{color:var(--color-text-tertiary) !important;}
/* Accounts strip */
.cc-accounts-row{border-top-color:var(--color-border-default) !important;}
.cc-accounts-row::after{background:linear-gradient(to right,transparent,var(--color-surface-raised)) !important;}
.cc-accounts-label{color:var(--color-text-tertiary) !important;}
.cc-acct-chip{background:var(--color-surface-sunken) !important;border-color:var(--color-border-default) !important;}
.cc-acct-chip:hover{background:var(--color-surface-base) !important;border-color:#C8C2BA !important;}
.cc-acct-chip.active{background:var(--color-surface-sunken) !important;border-color:var(--color-action) !important;}
.cc-acct-code{color:var(--color-text-tertiary) !important;}
.cc-acct-name{color:var(--color-text-primary) !important;}
.cc-acct-sep{background:var(--color-border-default) !important;}
/* SETTINGS nav items */
.sn-item{display:flex;align-items:center;gap:8px;padding:7px 12px;margin:1px 6px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;color:var(--color-text-secondary);transition:background var(--transition-fast),color var(--transition-fast);user-select:none}
.sn-item svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0}
.sn-item:hover{background:var(--color-surface-base);color:var(--color-text-primary)}
.sn-subitem{display:flex;align-items:center;padding:5px 12px 5px 34px;margin:1px 6px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;color:var(--color-text-tertiary);transition:background var(--transition-fast),color var(--transition-fast)}
.sn-subitem:hover{background:var(--color-surface-base);color:var(--color-text-primary)}
.sn-arrow{margin-left:auto;width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0;transition:transform var(--transition-base)}
/* Sidebar notification beside existing search */
.sb-search-wrap{display:flex;align-items:center;gap:8px;}
.sb-notif-btn{width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--color-border-default);background:var(--color-surface-raised);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;flex-shrink:0;}
.sb-notif-btn svg{width:14px;height:14px;stroke:var(--color-text-tertiary);fill:none;stroke-width:1.5;}
.sb-notif-dot{position:absolute;top:6px;right:6px;width:5px;height:5px;background:var(--color-brand);border-radius:50%;border:1.5px solid #fff;}
</style>`,
  );

  return withFontFix.replace(
    "</body>",
    `
<script>
  (function() {
    document.querySelectorAll(".sb-item,.sn-subitem").forEach((el) => {
      const label = (el.textContent || "").trim().toLowerCase();
      const routeMap = {
        "general ledger": "/general-ledger",
        "journal entry": "/journal-entry",
        "chart of accounts": "/chart-of-accounts",
        dimensions: "/dimensions",
      };
      const target = routeMap[label];
      if (!target) return;
      el.addEventListener("click", (event) => {
        event.preventDefault();
        if (window.top && window.top !== window) {
          window.top.location.pathname = target;
        } else {
          window.location.pathname = target;
        }
      });
    });
    const wrap = document.querySelector(".sb-search-wrap");
    if (wrap && !wrap.querySelector(".sb-notif-btn")) {
      const notif = document.createElement("button");
      notif.className = "sb-notif-btn";
      notif.type = "button";
      notif.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><span class="sb-notif-dot"></span>';
      wrap.appendChild(notif);
    }

    // Inject SETTINGS section before sb-bottom
    const sbBottom = document.querySelector(".sb-bottom");
    if (sbBottom && !document.getElementById("gl-settings-section")) {
      const settings = document.createElement("div");
      settings.id = "gl-settings-section";
      settings.innerHTML = \`
        <div class="sb-section">Settings</div>
        <div class="sn-item" onclick="toggleGlSection('accounting')">
          <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Accounting
          <svg class="sn-arrow" id="gl-arrow-accounting" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div id="gl-sub-accounting" style="display:none">
          <div class="sn-subitem">Chart of accounts</div>
          <div class="sn-subitem">Dimensions</div>
          <div class="sn-subitem">Fiscal year</div>
          <div class="sn-subitem">Currency</div>
        </div>
        <div class="sn-item" onclick="toggleGlSection('tax')">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
          Tax
          <svg class="sn-arrow" id="gl-arrow-tax" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div id="gl-sub-tax" style="display:none">
          <div class="sn-subitem">Tax codes</div>
          <div class="sn-subitem">Tax rates</div>
        </div>
        <div class="sn-item" onclick="toggleGlSection('access')">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Access
          <svg class="sn-arrow" id="gl-arrow-access" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div id="gl-sub-access" style="display:none">
          <div class="sn-subitem">Roles</div>
          <div class="sn-subitem">Users</div>
        </div>
        <div class="sn-item" onclick="toggleGlSection('integration')">
          <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Integration
          <svg class="sn-arrow" id="gl-arrow-integration" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div id="gl-sub-integration" style="display:none">
          <div class="sn-subitem">Bank feed</div>
          <div class="sn-subitem">Document inbox</div>
        </div>
      \`;
      sbBottom.parentNode.insertBefore(settings, sbBottom);
    }

    // Fix profile to match JE (Sarah Wijaya)
    const av = document.querySelector(".sb-av");
    if (av) av.textContent = "SW";
    const profileName = document.querySelector(".sb-profile-name");
    if (profileName) profileName.textContent = "Sarah Wijaya";

    // Toggle for SETTINGS sections
    window.toggleGlSection = function(key) {
      const sub = document.getElementById("gl-sub-" + key);
      const arrow = document.getElementById("gl-arrow-" + key);
      if (!sub) return;
      const open = sub.style.display !== "none";
      sub.style.display = open ? "none" : "block";
      if (arrow) arrow.style.transform = open ? "" : "rotate(90deg)";
    };
  })();
</script>
</body>`,
  );
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "serve-klay-prototype",
      configureServer(server) {
        const prototypePath = resolve("c:/Users/vinaz/Downloads/klay-prototype (1).html");
        const glPath = resolve("c:/Users/vinaz/Downloads/gl.html");
        const servePage = (view) => (_req, res) => {
          try {
            const html = readFileSync(prototypePath, "utf-8");
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(buildPrototypePage(html, view));
          } catch (error) {
            res.statusCode = 500;
            res.end(`Unable to load prototype file: ${String(error)}`);
          }
        };

        server.middlewares.use("/prototype/journal-entry.html", servePage("je"));
        server.middlewares.use("/prototype/chart-of-accounts.html", servePage("coa"));
        server.middlewares.use("/prototype/dimensions.html", servePage("dim"));
        server.middlewares.use("/prototype/general-ledger.html", (_req, res) => {
          try {
            const html = readFileSync(glPath, "utf-8");
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(buildGlPage(html));
          } catch (error) {
            res.statusCode = 500;
            res.end(`Unable to load GL file: ${String(error)}`);
          }
        });
      },
    },
  ],
});
