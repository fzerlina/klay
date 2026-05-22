import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReconReviewModal, { RECON_TOTAL, RECON_MATCHED, RECON_UNMATCHED } from "../components/ReconReviewModal";
import "./modules.css";
import "./invoices-ledger.css";
import "./close.css";

const PERIOD_LABEL = "April 2025";
const CLOSE_DAY = 3;
const CLOSE_DURATION = 5;

function KlaySparkleIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
      <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
    </svg>
  );
}

function fmtRp(n) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function StatusIcon({ tone }) {
  if (tone === "ok") {
    return (
      <svg className="close-status ok" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="6" fill="currentColor" stroke="none" />
        <polyline points="4 7 6.2 9.2 10 5.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg className="close-status warn" viewBox="0 0 14 14" aria-hidden>
        <path d="M7 1.5l5.5 10h-11z" fill="currentColor" stroke="none" />
        <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="#fff" strokeWidth="1.4" />
        <circle cx="7" cy="10" r="0.7" fill="#fff" stroke="none" />
      </svg>
    );
  }
  if (tone === "danger") {
    return (
      <svg className="close-status danger" viewBox="0 0 14 14" aria-hidden>
        <path d="M7 1.5l5.5 10h-11z" fill="currentColor" stroke="none" />
        <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="#fff" strokeWidth="1.4" />
        <circle cx="7" cy="10" r="0.7" fill="#fff" stroke="none" />
      </svg>
    );
  }
  return <span className="close-status dot" aria-hidden />;
}

function ZoneItem({ tone, label, value, action, onAction }) {
  return (
    <div className={`close-item ${tone || ""}`}>
      <StatusIcon tone={tone} />
      <div className="close-item-label">{label}</div>
      {value && <div className="close-item-value">{value}</div>}
      {action && (
        <button type="button" className="close-item-cta" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function ZoneCard({ title, leftCount, total, children }) {
  const allClear = leftCount === 0;
  return (
    <section className="close-zone">
      <header className="close-zone-head">
        <h2 className="close-zone-title">{title}</h2>
        <div className={`close-zone-tally${allClear ? " ok" : ""}`}>
          {allClear ? "All clear" : `${leftCount} left`}
          {total && <span className="close-zone-of"> · of {total}</span>}
        </div>
      </header>
      <div className="close-zone-body">{children}</div>
    </section>
  );
}

export default function CloseManagementPage() {
  const navigate = useNavigate();
  const [reconOpen, setReconOpen] = useState(false);
  const [resolved, setResolved] = useState(() => new Set());
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  function markResolved(key) {
    setResolved((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  // ── Mock close data ────────────────────────────────────────────────────
  const inventoryVariance = 2300000;
  const anomaliesCount = 4;
  const autosCount = 8;
  const accrualBooked = ["Depreciation", "Prepaid amortization", "Payroll accrual"];
  const accrualsPending = 2;
  const accrualsMissing = 1;

  // ── Blocker computation ────────────────────────────────────────────────
  const allBlockers = [
    "bank-unmatched",
    "inventory-variance",
    "anomalies",
    "autos",
    "accruals-pending",
    "accruals-missing",
  ];
  const totalBlockers = useMemo(
    () => allBlockers.filter((k) => !resolved.has(k)).length,
    [resolved],
  );

  const reconLeft = (resolved.has("bank-unmatched") ? 0 : 1) + (resolved.has("inventory-variance") ? 0 : 1);
  const klayQueueLeft = (resolved.has("anomalies") ? 0 : 1) + (resolved.has("autos") ? 0 : 1);
  const accrualsLeft = (resolved.has("accruals-pending") ? 0 : 1) + (resolved.has("accruals-missing") ? 0 : 1);

  function handleReconItemAction(action, item) {
    if (action === "match") showToast(`${item.id} matched — Klay will learn the pattern`);
    else if (action === "skip") showToast(`${item.id} skipped for now`);
  }

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="lg-head">
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Close Management</h1>
              <div className="close-meta">
                <span className="close-meta-period">{PERIOD_LABEL}</span>
                <span className="close-meta-sep">·</span>
                <span>Day {CLOSE_DAY} of {CLOSE_DURATION}</span>
                <span className="close-meta-sep">·</span>
                <span className={`close-meta-blockers${totalBlockers === 0 ? " ok" : ""}`}>
                  {totalBlockers === 0 ? "Ready to close" : `${totalBlockers} blockers`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Zones ───────────────────────────────────────────────────── */}
        <div className="close-zones">

          {/* Reconciliation */}
          <ZoneCard title="Reconciliation" leftCount={reconLeft}>
            <ZoneItem
              tone={resolved.has("bank-unmatched") ? "ok" : "warn"}
              label="Bank entries"
              value={resolved.has("bank-unmatched")
                ? `${RECON_TOTAL}/${RECON_TOTAL} matched`
                : `${RECON_MATCHED}/${RECON_TOTAL} matched`}
              action={resolved.has("bank-unmatched") ? null : `Review ${RECON_UNMATCHED.length} unmatched →`}
              onAction={() => setReconOpen(true)}
            />
            <ZoneItem tone="ok" label="AR aging" value="Ties to GL" />
            <ZoneItem tone="ok" label="AP aging" value="Ties to GL" />
            <ZoneItem
              tone={resolved.has("inventory-variance") ? "ok" : "warn"}
              label="Inventory"
              value={resolved.has("inventory-variance") ? "Ties to GL" : `Rp ${fmtRp(inventoryVariance)} variance`}
              action={resolved.has("inventory-variance") ? null : "Investigate →"}
              onAction={() => { showToast("3 SKUs disagree between count and ledger"); markResolved("inventory-variance"); }}
            />
          </ZoneCard>

          {/* Klay review queue */}
          <ZoneCard title="Klay review queue" leftCount={klayQueueLeft}>
            <ZoneItem
              tone={resolved.has("anomalies") ? "ok" : "danger"}
              label="Anomalies flagged"
              value={resolved.has("anomalies") ? "All reviewed" : `${anomaliesCount} flagged`}
              action={resolved.has("anomalies") ? null : "Review →"}
              onAction={() => { navigate("/journal-entry"); }}
            />
            <ZoneItem
              tone={resolved.has("autos") ? "ok" : "warn"}
              label="Auto-drafted awaiting confirmation"
              value={resolved.has("autos") ? "All confirmed" : `${autosCount} pending`}
              action={resolved.has("autos") ? null : "Review →"}
              onAction={() => { navigate("/invoices"); }}
            />
          </ZoneCard>

          {/* Accruals */}
          <ZoneCard title="Accruals" leftCount={accrualsLeft}>
            {accrualBooked.map((label) => (
              <ZoneItem key={label} tone="ok" label={label} value="Booked" />
            ))}
            <ZoneItem
              tone={resolved.has("accruals-pending") ? "ok" : "warn"}
              label="Recurring accruals"
              value={resolved.has("accruals-pending") ? "All approved" : `${accrualsPending} pending your approval`}
              action={resolved.has("accruals-pending") ? null : "Review →"}
              onAction={() => { showToast("2 accruals approved"); markResolved("accruals-pending"); }}
            />
            <ZoneItem
              tone={resolved.has("accruals-missing") ? "ok" : "warn"}
              label="Source documents"
              value={resolved.has("accruals-missing") ? "Complete" : `${accrualsMissing} missing source doc`}
              action={resolved.has("accruals-missing") ? null : "Chase →"}
              onAction={() => { showToast("Reminder sent to vendor"); markResolved("accruals-missing"); }}
            />
          </ZoneCard>
        </div>

        {/* ── Ready to close ──────────────────────────────────────────── */}
        <div className="close-cta-wrap">
          <button
            type="button"
            className="close-cta"
            disabled={totalBlockers > 0}
            onClick={() => showToast(`${PERIOD_LABEL} closed ✓`)}
          >
            <KlaySparkleIcon />
            Ready to close period →
          </button>
          {totalBlockers > 0 ? (
            <div className="close-cta-hint">
              Resolve {totalBlockers} blocker{totalBlockers === 1 ? "" : "s"} to close {PERIOD_LABEL}
            </div>
          ) : (
            <div className="close-cta-hint ok">
              All blockers resolved · ready for manager review
            </div>
          )}
        </div>
      </div>

      {/* ── Bank-reconciliation review modal ─────────────────────────── */}
      <ReconReviewModal
        open={reconOpen}
        items={RECON_UNMATCHED}
        onClose={() => { setReconOpen(false); markResolved("bank-unmatched"); }}
        onAction={handleReconItemAction}
      />

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
