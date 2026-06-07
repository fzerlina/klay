// Close Command Center — universal Close page with AP / AR / GL module tabs.
// The AP tab implements the PRD's 5-gate computed model (Bill Detail PRD,
// AP Close Command Center & Accrual Intelligence). Close is a state, not an
// event: gates are always-on, always-current; when all five are GREEN, FM can
// declare AP closed for the period. AR and GL tabs are mocked placeholders
// pending their own PRDs.
//
// What this surface deliberately does NOT include (per PRD):
// — "Days to close" countdown / "Target close" date (close is continuous)
// — "Edit checklist" / "New task" buttons (no user-editable checklist)
// — Non-AP routine accruals (depreciation, prepaid, payroll → GL module)
// — Per-task assignee/reviewer columns (FM is sole supervisor; Klay is engine)

import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ACCOUNTS as BANK_ACCOUNTS, INITIAL_TRANSACTIONS as BANK_TRANSACTIONS } from "./BankReconciliationPage";
import { JOURNAL_ENTRIES as SEED_JOURNAL_ENTRIES } from "../data/seed/journalEntries";
import { VENDORS } from "../data/seed/vendors";
import { ACCRUAL_CANDIDATES, SUPPRESSED_CANDIDATES, GATE_2_SUB_INDICATORS } from "../data/seed/accrualCandidates";
import { workflowStatus } from "../lib/billStatus";
import { buildAgingLines, buildSnapshot } from "../lib/apAging";
import { useBills } from "../state/BillsContext";
import { useClosePeriod } from "../state/ClosePeriodContext";
import { useCurrentUser } from "../state/CurrentUserContext";
import "./modules.css";
import "./invoices-ledger.css";
import "./close.css";

// ── Demo constants ────────────────────────────────────────────────────────
// The close period is April 2025 — matches lib/clock.js TODAY (2025-04-23)
// and the AP_CLOSED_THROUGH = "2025-02" baseline (Jan + Feb already closed,
// March was closed mid-prototype, April is the live close).
const CLOSE_PERIOD = "2025-04";
const CLOSE_PERIOD_LABEL = "April 2025";
const CLOSE_PERIOD_END = "2025-04-30";
const PRIOR_PERIOD_OPTIONS = [
  { value: "2025-04", label: "April 2025", interactive: true },
  { value: "2025-03", label: "March 2025", interactive: false },
  { value: "2025-02", label: "February 2025", interactive: false },
  { value: "2025-01", label: "January 2025", interactive: false },
];

// ── Icons ─────────────────────────────────────────────────────────────────
function SparkleIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5l1.1 2.7L9.8 5l-2.7 0.8L6 8.5l-1.1-2.7L2.2 5l2.7-0.8L6 1.5z" />
      <path d="M10 8.5l0.4 1L11.5 10l-1.1 0.4L10 11.5l-0.4-1.1L8.5 10l1.1-0.5L10 8.5z" />
    </svg>
  );
}
const I = {
  check:   <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5 6 5 8.5 9.5 3.5"/></svg>,
  chev:    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 4.5 6 7.5 9 4.5"/></svg>,
  alert:   <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="5"/><line x1="6" y1="3.5" x2="6" y2="6.5"/><line x1="6" y1="8.4" x2="6.01" y2="8.4"/></svg>,
  lock:    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5.5" width="7" height="5" rx="0.8"/><path d="M4.2 5.5V3.8a1.8 1.8 0 0 1 3.6 0v1.7"/></svg>,
  ext:     <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4.5 2.5 9 2.5 9 7"/><line x1="9" y1="2.5" x2="5" y2="6.5"/><path d="M9 7.5v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h2"/></svg>,
  refresh: <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9.5 2 9.5 5 6.5 5"/><path d="M9 4.5A4.5 4.5 0 1 0 10 8"/></svg>,
};

// ── Bank rec stats (derived from the Bank Reconciliation page seed) ──────
const RECON_STATS = (() => {
  const totalAccounts = BANK_ACCOUNTS.length;
  const statementsUploaded = BANK_ACCOUNTS.filter((a) => a.statementPeriod && a.statementPeriod !== "no statement yet").length;
  let matched = 0, autoPending = 0, toMatch = 0;
  for (const acctId of Object.keys(BANK_TRANSACTIONS)) {
    for (const t of BANK_TRANSACTIONS[acctId]) {
      if (t.status === "matched") matched++;
      else if (t.status === "auto") autoPending++;
      else if (t.status === "to-match") toMatch++;
    }
  }
  const totalTx = matched + autoPending + toMatch;
  const allReconciled = toMatch === 0 && statementsUploaded === totalAccounts;
  const klayAutomated = matched + autoPending;
  const automationPct = totalTx ? Math.round((klayAutomated / totalTx) * 100) : 0;
  return { totalAccounts, statementsUploaded, totalTx, matched, autoPending, toMatch, klayAutomated, automationPct, allReconciled };
})();

// ── Gate state model ──────────────────────────────────────────────────────
function gateState(count) {
  if (count === 0) return "GREEN";
  if (count <= 2) return "AMBER";
  return "RED";
}

// ── Currency helper ───────────────────────────────────────────────────────
function fmtRp(n) {
  if (n == null || isNaN(n)) return "—";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

// ── Format datetime in WIB-ish style ──────────────────────────────────────
function formatDeclTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
}

// ════════════════════════════════════════════════════════════════════════
// Gate row — used by every gate (AP, AR, GL). The Klay sparkle is shown
// only when Klay computed the state from system data (default for all gates).
// ════════════════════════════════════════════════════════════════════════
function GateRow({ number, title, status, summary, klayLine, expanded, onToggle, children, externalAction }) {
  const isGreen = status === "GREEN";
  return (
    <div className={`gate-row gate-${status.toLowerCase()}${expanded ? " expanded" : ""}`}>
      <button type="button" className="gate-row-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="gate-row-number">{number}</span>
        <span className="gate-row-title">{title}</span>
        <span className="gate-row-summary">{summary}</span>
        <span className={`gate-state-pill gate-state-${status.toLowerCase()}`}>
          {isGreen && I.check}
          {status}
        </span>
        <span className={`gate-row-chev${expanded ? " open" : ""}`} aria-hidden>{I.chev}</span>
      </button>
      {klayLine && (
        <div className="gate-row-klay">
          <SparkleIcon />
          <span>{klayLine}</span>
          {externalAction && (
            <button type="button" className="gate-row-ext" onClick={externalAction.onClick}>
              {externalAction.label} {I.ext}
            </button>
          )}
        </div>
      )}
      {expanded && children && <div className="gate-row-body">{children}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Gate 2 sub-indicator panel — three Indonesian-specific informational
// flags. Don't block Gate 2 from being green; surface evidentiary gaps
// the FM should resolve before remittance / SPT filing.
// ════════════════════════════════════════════════════════════════════════
function Gate2SubIndicators({ subs, onDrill }) {
  const allClear = subs.pph_remittance.count + subs.faktur_pajak.count + subs.no_document_bills.count === 0;
  if (allClear) {
    return (
      <div className="sub-indicators-empty">
        <SparkleIcon />
        <span>All Indonesian tax + evidentiary checks clear — PPh remitted, Faktur Pajak captured, no document gaps.</span>
      </div>
    );
  }
  return (
    <div className="sub-indicators">
      <div className="sub-indicators-head">Tax + evidentiary sub-checks (informational, don't block close)</div>
      {[subs.pph_remittance, subs.faktur_pajak, subs.no_document_bills].map((sub, idx) => (
        <div key={sub.label} className={`sub-indicator-row${sub.count === 0 ? " ok" : ""}`}>
          <span className={`sub-indicator-dot${sub.count === 0 ? " ok" : ""}`} aria-hidden />
          <span className="sub-indicator-label">{sub.label}</span>
          <span className="sub-indicator-detail">{sub.count === 0 ? "Clear" : sub.detail}</span>
          {sub.count > 0 && (
            <button type="button" className="sub-indicator-cta" onClick={() => onDrill(idx, sub)}>
              View {sub.count} {I.ext}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Accrual candidate card — Gate 5 detail. Per PRD ASCII mockup: vendor,
// suggested amount, basis, PPh component (when applicable), GL entry
// preview, reversal date. Actions: Book accrual / Adjust / Skip.
// ════════════════════════════════════════════════════════════════════════
function AccrualCard({ candidate, onBook, onAdjust, onSkip, readOnly = false }) {
  const isPph23 = candidate.pph_category === "pph23_2";
  return (
    <div className="accrual-card">
      <div className="accrual-card-head">
        <div className="accrual-card-vendor">
          <span className="accrual-card-vendor-avatar">{candidate.vendor_initials}</span>
          <div>
            <div className="accrual-card-vendor-name">{candidate.vendor_name}</div>
            <div className="accrual-card-vendor-meta">
              {candidate.pkp_status === "PKP" ? "PKP vendor" : "Non-PKP vendor"} · {candidate.pph_category === "pph23_2" ? "PPh 23 @ 2%" : "No PPh"}
            </div>
          </div>
        </div>
        <div className="accrual-card-signal">
          <SparkleIcon />
          <span>{candidate.detection_signal === "RECURRING_GAP" ? "Hasn't invoiced this month — recurring vendor" : candidate.detection_signal === "PRIOR_ACCRUAL_PATTERN" ? "Prior accrual pattern — invoices in arrears" : "Manually flagged for monthly accrual"}</span>
        </div>
      </div>

      <div className="accrual-card-body">
        <div className="accrual-card-amount-block">
          <div className="accrual-card-amount-label">Suggested accrual</div>
          <div className="accrual-card-amount">{fmtRp(candidate.gross_amount)}</div>
          <div className="accrual-card-basis">Basis: {candidate.basis_label}</div>
        </div>

        <div className="accrual-card-ledger">
          <div className="accrual-card-ledger-head">GL entry preview · auto-reverses {candidate.accrual_reversal_date}</div>
          <div className="accrual-card-ledger-line">
            <span className="ledger-side dr">DR</span>
            <span className="ledger-acct">{candidate.expense_account} {candidate.expense_account_label}</span>
            <span className="ledger-amt">{fmtRp(candidate.gross_amount)}</span>
          </div>
          <div className="accrual-card-ledger-line">
            <span className="ledger-side cr">CR</span>
            <span className="ledger-acct">2-1300 Accrued Liabilities</span>
            <span className="ledger-amt">{fmtRp(candidate.net_to_vendor)}</span>
          </div>
          {isPph23 && (
            <div className="accrual-card-ledger-line">
              <span className="ledger-side cr">CR</span>
              <span className="ledger-acct">2-1500 PPh 23 Payable</span>
              <span className="ledger-amt">{fmtRp(candidate.pph_amount)}</span>
            </div>
          )}
          {candidate.no_faktur_pajak_flag && (
            <div className="accrual-card-pkp-note">
              <SparkleIcon />
              PPN excluded — Faktur Pajak not yet received. PPN input credit captured when actual invoice arrives.
            </div>
          )}
        </div>
      </div>

      {readOnly ? (
        <div className="accrual-card-readonly-note">
          <SparkleIcon size={13} />
          <span>Klay suggested this accrual. Your Finance Manager books or skips it before close.</span>
        </div>
      ) : (
        <div className="accrual-card-actions">
          <button type="button" className="accrual-action-primary" onClick={onBook}>Book accrual</button>
          <button type="button" className="accrual-action-secondary" onClick={onAdjust}>Adjust amount</button>
          <button type="button" className="accrual-action-tertiary" onClick={onSkip}>Skip this vendor</button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Declare close confirmation modal — shows gate snapshot per PRD.
// ════════════════════════════════════════════════════════════════════════
function DeclareCloseModal({ open, period, periodLabel, gates, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="declare-modal-backdrop" onClick={onCancel}>
      <div className="declare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="declare-modal-head">
          <div className="declare-modal-title">Declare AP closed for {periodLabel}</div>
          <button type="button" className="declare-modal-close" onClick={onCancel} aria-label="Cancel">×</button>
        </div>
        <div className="declare-modal-body">
          <p className="declare-modal-intro">
            You are about to close AP for {periodLabel}. A snapshot of all five gates will be recorded with this declaration.
          </p>
          <div className="declare-modal-snapshot">
            {gates.map((g) => (
              <div key={g.number} className="declare-modal-gate">
                <span className="declare-modal-gate-num">{g.number}</span>
                <span className="declare-modal-gate-name">{g.title}</span>
                <span className="declare-modal-gate-summary">{g.summary}</span>
                <span className={`gate-state-pill gate-state-${g.status.toLowerCase()}`}>{g.status === "GREEN" && I.check}{g.status}</span>
              </div>
            ))}
          </div>
          <div className="declare-modal-note">
            <span className="declare-modal-note-title">After closing:</span>
            <ul>
              <li>All client users (Finance Manager included) will be locked from posting bills to {periodLabel} via normal flow.</li>
              <li>Bills already in PENDING_REVIEW, RETURNED, or APPROVED for this period stay where they are — explicit Reassign required.</li>
              <li>To post a late bill into {periodLabel} afterwards, a user with the <code>period.reopen</code> permission (Finance Manager by default) can reopen from Settings → Period Locking with a structured reason.</li>
              <li>CFO is notified of the declaration.</li>
            </ul>
          </div>
        </div>
        <div className="declare-modal-foot">
          <button type="button" className="close-head-btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="close-head-btn primary" onClick={onConfirm}>Confirm close</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Gate-computation helpers — pure functions so the parent can compute each
// module's gate summary for the combined progress bar without re-running
// the child component's render.
// ════════════════════════════════════════════════════════════════════════
function computeApGateSummary(bills, bookedIds, dismissedIds) {
  // Gate 1: Belum Diposting — APPROVED bills awaiting POST in the close period.
  const gate1Bills = bills.filter((b) => workflowStatus(b) === "APPROVED" && b.date && b.date.startsWith(CLOSE_PERIOD));
  // Gate 2: Exceptions — RETURNED + ON_HOLD + EXCEPTION in the close period.
  const gate2Bills = bills.filter((b) => {
    const ws = workflowStatus(b);
    return (ws === "RETURNED" || ws === "ON_HOLD" || ws === "EXCEPTION") && b.date && b.date.startsWith(CLOSE_PERIOD);
  });
  // Gate 3a / 3b via the existing AP aging snapshot.
  const lines = buildAgingLines(bills);
  const snap = buildSnapshot(lines);
  const gate3 = snap.reconciliation;
  const gate3aStatus = Math.abs(gate3.gate_3a_delta) === 0 ? "GREEN" : "RED";
  const gate3bStatus = Math.abs(gate3.gate_3b_delta) === 0 ? "GREEN" : "RED";
  const gate3Status = (gate3aStatus === "GREEN" && gate3bStatus === "GREEN") ? "GREEN" : "RED";
  // Gate 4: Bank rec.
  const gate4Status = RECON_STATS.allReconciled ? "GREEN" : (RECON_STATS.toMatch <= 2 ? "AMBER" : "RED");
  // Gate 5: Accrual readiness.
  const pendingCandidates = ACCRUAL_CANDIDATES.filter((c) => !bookedIds.has(c.id) && !dismissedIds.has(c.id));
  const gate5Count = pendingCandidates.length;
  const gate5Status = gateState(gate5Count);
  const gate1Count = gate1Bills.length;
  const gate2Count = gate2Bills.length;
  const gate1Status = gateState(gate1Count);
  const gate2Status = gateState(gate2Count);

  return {
    bills: { gate1Bills, gate2Bills },
    recon: { gate3, gate3aStatus, gate3bStatus },
    pendingCandidates,
    summary: [
      { number: 1, key: "g1", title: "Belum Diposting", status: gate1Status, summary: `${gate1Count} bill${gate1Count === 1 ? "" : "s"} approved, not yet posted` },
      { number: 2, key: "g2", title: "Exceptions", status: gate2Status, summary: gate2Count === 0 ? "0 open" : `${gate2Count} open` },
      { number: 3, key: "g3", title: "Subledger = GL (3a + 3b)", status: gate3Status, summary: `AP delta ${fmtRp(gate3.gate_3a_delta)} · Accrued delta ${fmtRp(gate3.gate_3b_delta)}` },
      { number: 4, key: "g4", title: "Bank Reconciliation", status: gate4Status, summary: gate4Status === "GREEN" ? "All accounts reconciled" : `${RECON_STATS.toMatch} unmatched · ${RECON_STATS.totalAccounts - RECON_STATS.statementsUploaded} statement${RECON_STATS.totalAccounts - RECON_STATS.statementsUploaded === 1 ? "" : "s"} pending` },
      { number: 5, key: "g5", title: "Accrual Readiness", status: gate5Status, summary: gate5Count === 0 ? "All candidates reviewed" : `${gate5Count} candidate${gate5Count === 1 ? "" : "s"} pending review` },
    ],
  };
}

// AR — mocked placeholders pending AR Close PRD.
const AR_GATE_SUMMARY = [
  { number: 1, key: "ar1", title: "Belum Diposting", status: "GREEN", summary: "0 invoices approved, not yet posted", klay: "Klay confirmed every approved invoice is posted to the GL." },
  { number: 2, key: "ar2", title: "Exceptions Resolved", status: "GREEN", summary: "0 open", klay: "Klay scanned customer invoices for billing, credit, and confidence exceptions — none open." },
  { number: 3, key: "ar3", title: "Subledger = GL", status: "GREEN", summary: "AR delta Rp 0", klay: "Klay reconciled AR subledger against GL 1-2100 (Accounts Receivable) — both layers tie." },
  { number: 4, key: "ar4", title: "Receipts Reconciled", status: "AMBER", summary: "3 unapplied receipts", klay: "Klay matched 47 of 50 receipts to open invoices · 3 surfaced for review." },
  { number: 5, key: "ar5", title: "Revenue Recognition", status: "GREEN", summary: "0 deferrals pending", klay: "Klay swept the deferred-revenue waterfall — every milestone-based recognition is up to date." },
];

// GL — placeholder until GL Close PRD lands.
function computeGlGateSummary() {
  const draftJes = SEED_JOURNAL_ENTRIES.filter((j) => j.status === "draft").length;
  return [
    { number: 1, key: "gl1", title: "Manual JEs Posted", status: draftJes === 0 ? "GREEN" : "AMBER", summary: draftJes === 0 ? "0 drafts pending" : `${draftJes} drafts pending post`, klay: `Klay drafted ${draftJes} journal entries from upstream module activity — all routed to the JE Drafts queue.`, link: "/journal-entry?tab=draft", linkLabel: "Open Journal Entry" },
    { number: 2, key: "gl2", title: "Trial Balance Balanced", status: "GREEN", summary: "Debits = Credits", klay: "Klay ran the trial balance check — debits and credits reconcile.", link: "/trial-balance", linkLabel: "Open Trial Balance" },
    { number: 3, key: "gl3", title: "Routine Accruals", status: "GREEN", summary: "Booked by GL module", klay: "Klay's GL module owns depreciation, prepaid amortization, and payroll accruals separately from AP. This page surfaces AP-relevant activity only.", link: null },
  ];
}

// ════════════════════════════════════════════════════════════════════════
// Combined progress bar — one segmented bar covering AP + AR + GL. Each
// module's slice width is proportional to its gate count; fill within the
// slice = green gates / total gates. Below the bar: per-module counts.
// ════════════════════════════════════════════════════════════════════════
function CombinedProgressBar({ modules, periodLabel, allClosed }) {
  const totalGates = modules.reduce((s, m) => s + m.gates.length, 0);
  const totalGreen = modules.reduce((s, m) => s + m.gates.filter((g) => g.status === "GREEN").length, 0);

  return (
    <div className={`combined-progress${allClosed ? " all-closed" : ""}`}>
      <div className="combined-progress-head">
        <div className="combined-progress-headline">
          <span className="combined-progress-num">{totalGreen}</span>
          <span className="combined-progress-of">of {totalGates} gates closed</span>
          <span className="combined-progress-period">· {periodLabel}</span>
        </div>
        <div className="combined-progress-verdict">
          {allClosed ? "Buku sudah terkini" : "Buku belum terkini"}
        </div>
      </div>

      <div className="combined-progress-bar" role="img" aria-label={`${totalGreen} of ${totalGates} gates closed across ${modules.length} modules`}>
        {modules.map((m, idx) => {
          const green = m.gates.filter((g) => g.status === "GREEN").length;
          const amber = m.gates.filter((g) => g.status === "AMBER").length;
          const red = m.gates.filter((g) => g.status === "RED").length;
          const total = m.gates.length;
          const widthPct = (total / totalGates) * 100;
          return (
            <div
              key={m.key}
              className="combined-progress-segment"
              style={{ flexBasis: `${widthPct}%` }}
              title={`${m.label} — ${green} green, ${amber} amber, ${red} red`}
            >
              <div className="combined-progress-segment-fill">
                {green > 0 && <span className="combined-progress-fill green" style={{ flexBasis: `${(green / total) * 100}%` }} />}
                {amber > 0 && <span className="combined-progress-fill amber" style={{ flexBasis: `${(amber / total) * 100}%` }} />}
                {red > 0 && <span className="combined-progress-fill red" style={{ flexBasis: `${(red / total) * 100}%` }} />}
              </div>
              <div className="combined-progress-segment-label">
                <span className="combined-progress-segment-name">{m.label}</span>
                <span className="combined-progress-segment-count">{green}/{total}{m.mocked ? " · mock" : ""}{m.locked ? " · locked" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// AP TAB — full PRD implementation: 5 gates + Accrual Intelligence
// ════════════════════════════════════════════════════════════════════════
function ApGates({ bills, navigate, onDeclareClose, periodLabel, locked, lockedAt, apState, bookedIds, dismissedIds, onBook, onDismiss, canOperate = true }) {
  const [expanded, setExpanded] = useState(new Set(["g2", "g5"]));
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);
  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 2200);
  }
  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const gate1Bills = apState.bills.gate1Bills;
  const gate2Bills = apState.bills.gate2Bills;
  const gate3 = apState.recon.gate3;
  const gate3aStatus = apState.recon.gate3aStatus;
  const gate3bStatus = apState.recon.gate3bStatus;
  const pendingCandidates = apState.pendingCandidates;
  const gateSummary = apState.summary;
  const gate1Status = gateSummary[0].status;
  const gate2Status = gateSummary[1].status;
  const gate3Status = gateSummary[2].status;
  const gate4Status = gateSummary[3].status;
  const gate5Status = gateSummary[4].status;
  const gate1Count = gate1Bills.length;
  const gate2Count = gate2Bills.length;
  const gate5Count = pendingCandidates.length;

  const allGreen = !locked && gate1Status === "GREEN" && gate2Status === "GREEN" && gate3Status === "GREEN" && gate4Status === "GREEN" && gate5Status === "GREEN";

  // ── Action handlers ───────────────────────────────────────────────────
  function handleBook(c) {
    onBook(c.id);
    showToast(`Accrual booked · ${c.vendor_name} · ${fmtRp(c.gross_amount)} · auto-reverse ${c.accrual_reversal_date}`);
  }
  function handleDismiss(c) {
    onDismiss(c.id);
    showToast(`${c.vendor_name} dismissed — no accrual booked this period`);
  }
  function handleAdjust(c) {
    showToast(`Adjust amount — opens detail editor (demo)`);
  }
  function handleSubDrill(idx, sub) {
    if (idx === 0) navigate("/chart-of-accounts");          // PPh remittance → CoA detail
    else if (idx === 1) navigate("/bills?filter=missingFp"); // Faktur Pajak completeness → Bills List filter (demo)
    else navigate("/bills?filter=noDocument");               // No-document bills → Bills List filter (demo)
  }

  return (
    <div className="ap-gates-wrap">
      {locked && (
        <div className="period-locked-banner">
          <span className="period-locked-icon">{I.lock}</span>
          <span>
            <strong>AP buku sudah terkini</strong> — {periodLabel} declared closed{lockedAt ? ` · ${formatDeclTime(lockedAt)}` : ""}.
            All client users are locked from posting to this period.
          </span>
        </div>
      )}

      {/* GATE 1 */}
      <GateRow
        number={1}
        title="Belum Diposting"
        status={gate1Status}
        summary={gateSummary[0].summary}
        klayLine={gate1Count === 0
          ? "Klay confirmed every approved bill for April is posted to the GL."
          : `Klay verified ${gate1Count} approved bill${gate1Count === 1 ? " is" : "s are"} ready for post — Finance Manager confirmation needed.`}
        expanded={expanded.has("g1")}
        onToggle={() => toggleExpand("g1")}
        externalAction={gate1Count > 0 ? { label: "Review in Bills", onClick: () => navigate("/bills?filter=apClose") } : null}
      >
        {gate1Bills.slice(0, 6).map((b) => (
          <div key={b.id} className="gate-detail-row" onClick={() => navigate(`/bills/${b.id}`)}>
            <span className="gate-detail-id">{b.id}</span>
            <span className="gate-detail-vendor">{b.vendorName}</span>
            <span className="gate-detail-amt">{fmtRp(b.total)}</span>
            <span className="gate-detail-link">Open {I.ext}</span>
          </div>
        ))}
        {gate1Bills.length > 6 && (
          <div className="gate-detail-more" onClick={() => navigate("/bills?filter=apClose")}>
            +{gate1Bills.length - 6} more · view all in Bills {I.ext}
          </div>
        )}
      </GateRow>

      {/* GATE 2 */}
      <GateRow
        number={2}
        title="Exceptions Resolved"
        status={gate2Status}
        summary={gateSummary[1].summary}
        klayLine={gate2Count === 0
          ? "Klay scanned every bill for matching, coding, and confidence exceptions — none open."
          : `Klay flagged ${gate2Count} exception${gate2Count === 1 ? "" : "s"} that need Finance Manager judgment.`}
        expanded={expanded.has("g2")}
        onToggle={() => toggleExpand("g2")}
        externalAction={gate2Count > 0 ? { label: "Review exceptions", onClick: () => navigate("/bills?filter=exceptions") } : null}
      >
        <Gate2SubIndicators subs={GATE_2_SUB_INDICATORS} onDrill={handleSubDrill} />
        {gate2Bills.length > 0 && (
          <div className="gate-detail-list">
            <div className="gate-detail-list-head">Open exceptions</div>
            {gate2Bills.slice(0, 6).map((b) => (
              <div key={b.id} className="gate-detail-row" onClick={() => navigate(`/bills/${b.id}`)}>
                <span className="gate-detail-id">{b.id}</span>
                <span className="gate-detail-vendor">{b.vendorName}</span>
                <span className="gate-detail-state">{workflowStatus(b)}</span>
                <span className="gate-detail-amt">{fmtRp(b.total)}</span>
                <span className="gate-detail-link">Open {I.ext}</span>
              </div>
            ))}
          </div>
        )}
      </GateRow>

      {/* GATE 3 */}
      <GateRow
        number={3}
        title="Subledger = GL"
        status={gate3Status}
        summary={gateSummary[2].summary}
        klayLine={`Klay reconciled both subledgers against their GL control accounts ${gate3.verified_hours_ago}h ago. AP Control and Accrued Liabilities tie.`}
        expanded={expanded.has("g3")}
        onToggle={() => toggleExpand("g3")}
      >
        <div className="recon-split">
          <div className={`recon-half recon-${gate3aStatus.toLowerCase()}`}>
            <div className="recon-half-head">
              <span className="recon-half-label">Gate 3a · AP Control</span>
              <span className={`gate-state-pill gate-state-${gate3aStatus.toLowerCase()} sm`}>{gate3aStatus === "GREEN" && I.check}{gate3aStatus}</span>
            </div>
            <div className="recon-half-detail">Normal posted bills · reconciles to GL 2-1100</div>
            <div className="recon-half-delta">Delta: {fmtRp(gate3.gate_3a_delta)}</div>
          </div>
          <div className={`recon-half recon-${gate3bStatus.toLowerCase()}`}>
            <div className="recon-half-head">
              <span className="recon-half-label">Gate 3b · Accrued Liabilities</span>
              <span className={`gate-state-pill gate-state-${gate3bStatus.toLowerCase()} sm`}>{gate3bStatus === "GREEN" && I.check}{gate3bStatus}</span>
            </div>
            <div className="recon-half-detail">Accrual bills · reconciles to GL 2-1300</div>
            <div className="recon-half-delta">Delta: {fmtRp(gate3.gate_3b_delta)}</div>
          </div>
        </div>
      </GateRow>

      {/* GATE 4 */}
      <GateRow
        number={4}
        title="Bank Reconciliation"
        status={gate4Status}
        summary={gateSummary[3].summary}
        klayLine={`Klay matched ${RECON_STATS.matched} of ${RECON_STATS.totalTx} bank lines (${RECON_STATS.automationPct}%). ${RECON_STATS.autoPending} auto-applied awaiting sign-off${RECON_STATS.toMatch > 0 ? `; ${RECON_STATS.toMatch} surfaced for review` : ""}.`}
        expanded={expanded.has("g4")}
        onToggle={() => toggleExpand("g4")}
        externalAction={{ label: "Open Bank Reconciliation", onClick: () => navigate("/bank-reconciliation") }}
      >
        <div className="bank-acct-grid">
          {BANK_ACCOUNTS.map((a) => {
            const tx = BANK_TRANSACTIONS[a.id] || [];
            const unmatched = tx.filter((t) => t.status === "to-match").length;
            const hasStatement = a.statementPeriod && a.statementPeriod !== "no statement yet";
            const acctStatus = !hasStatement ? "RED" : unmatched > 0 ? "AMBER" : "GREEN";
            return (
              <div key={a.id} className={`bank-acct-cell bank-acct-${acctStatus.toLowerCase()}`}>
                <div className="bank-acct-name">{a.name}</div>
                <div className="bank-acct-detail">
                  {!hasStatement ? "No statement uploaded" : unmatched > 0 ? `${unmatched} unmatched line${unmatched === 1 ? "" : "s"}` : "Fully reconciled"}
                </div>
              </div>
            );
          })}
        </div>
      </GateRow>

      {/* GATE 5 — Accrual Readiness */}
      <GateRow
        number={5}
        title="Accrual Readiness"
        status={gate5Status}
        summary={gateSummary[4].summary}
        klayLine={gate5Count === 0
          ? `Klay reviewed every recurring vendor and prior-accrual pattern — no candidates pending.`
          : `Klay identified ${gate5Count} vendor${gate5Count === 1 ? "" : "s"} who haven't invoiced this month. Review and book or skip before close.`}
        expanded={expanded.has("g5")}
        onToggle={() => toggleExpand("g5")}
      >
        <div className="accrual-grid">
          {pendingCandidates.map((c) => (
            <AccrualCard
              key={c.id}
              candidate={c}
              onBook={() => handleBook(c)}
              onAdjust={() => handleAdjust(c)}
              onSkip={() => handleDismiss(c)}
              readOnly={!canOperate}
            />
          ))}
          {pendingCandidates.length === 0 && (
            <div className="accrual-empty">
              <SparkleIcon size={14} />
              <span>All accrual candidates reviewed for {periodLabel}. {bookedIds.size > 0 && `${bookedIds.size} booked · `}{dismissedIds.size > 0 && `${dismissedIds.size} dismissed.`}</span>
            </div>
          )}
        </div>
        <button type="button" className="accrual-show-suppressed" onClick={() => setShowSuppressed((s) => !s)}>
          {showSuppressed ? "Hide" : "Show"} {SUPPRESSED_CANDIDATES.length} suppressed candidate{SUPPRESSED_CANDIDATES.length === 1 ? "" : "s"}
        </button>
        {showSuppressed && (
          <div className="accrual-suppressed-list">
            {SUPPRESSED_CANDIDATES.map((c) => (
              <div key={c.id} className="accrual-suppressed-row">
                <span className="accrual-suppressed-vendor">{c.vendor_name}</span>
                <span className="accrual-suppressed-reason">Dismissed: "{c.dismiss_reason}"</span>
                {canOperate && <button type="button" className="accrual-suppressed-restore" onClick={() => showToast(`${c.vendor_name} restored to candidate queue`)}>Restore</button>}
              </div>
            ))}
          </div>
        )}
      </GateRow>

      {/* Declare close CTA bar */}
      <div className="declare-cta-wrap">
        {!canOperate ? (
          <span className="declare-cta-hint">
            {allGreen
              ? `All five gates are green — AP is ready for your Finance Manager to declare ${periodLabel} closed.`
              : `${gateSummary.filter((g) => g.status !== "GREEN").length} gate${gateSummary.filter((g) => g.status !== "GREEN").length === 1 ? "" : "s"} not yet green. Declaring close is your Finance Manager's call — your job is to clear what's assigned to you.`}
          </span>
        ) : allGreen ? (
          <>
            <button type="button" className="declare-cta" onClick={() => onDeclareClose(gateSummary)}>
              Declare AP closed for {periodLabel}
            </button>
            <span className="declare-cta-hint ok">All five gates are green — AP is ready to close.</span>
          </>
        ) : locked ? (
          <span className="declare-cta-hint locked">
            {I.lock} {periodLabel} closed{lockedAt ? ` · ${formatDeclTime(lockedAt)}` : ""}
          </span>
        ) : (
          <>
            <button type="button" className="declare-cta" disabled>
              Declare AP closed for {periodLabel}
            </button>
            <span className="declare-cta-hint">
              {gateSummary.filter((g) => g.status !== "GREEN").length} gate{gateSummary.filter((g) => g.status !== "GREEN").length === 1 ? "" : "s"} not yet green — resolve blockers before declaring close.
            </span>
          </>
        )}
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// AR TAB — mocked gates mirroring AP. PRD is not yet written; values shown
// here are placeholders. Once the AR Close PRD lands, the gate definitions,
// queries, and detail panels will be replaced.
// ════════════════════════════════════════════════════════════════════════
function ArGates({ navigate, gates }) {
  return (
    <div className="ap-gates-wrap">
      <div className="mocked-banner">
        <SparkleIcon size={12} />
        <span>AR Close PRD in flight — gate definitions below are illustrative placeholders that mirror AP's structure.</span>
      </div>
      {gates.map((g) => (
        <GateRow
          key={g.number}
          number={g.number}
          title={g.title}
          status={g.status}
          summary={g.summary}
          klayLine={g.klay}
          expanded={false}
          onToggle={() => {}}
          externalAction={g.number === 4 ? { label: "Open Bank Reconciliation", onClick: () => navigate("/bank-reconciliation") } : null}
        />
      ))}
      <div className="declare-cta-wrap">
        <button type="button" className="declare-cta" disabled>
          Declare AR closed for April 2025
        </button>
        <span className="declare-cta-hint">1 gate not yet green — resolve blockers before declaring close.</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// GL TAB — placeholder. Per the user direction, non-AP routine accruals
// (depreciation, prepaid amortization, payroll) are out of scope for this
// page; they belong to the GL module's JE capabilities (forthcoming).
// ════════════════════════════════════════════════════════════════════════
function GlGates({ navigate, gates }) {
  return (
    <div className="ap-gates-wrap">
      <div className="mocked-banner">
        <SparkleIcon size={12} />
        <span>GL Close PRD in flight — gate definitions below are illustrative. Routine accruals (depreciation, prepaid, payroll) will live in the GL module per the AP Close PRD scope.</span>
      </div>
      {gates.map((g) => (
        <GateRow
          key={g.number}
          number={g.number}
          title={g.title}
          status={g.status}
          summary={g.summary}
          klayLine={g.klay}
          expanded={false}
          onToggle={() => {}}
          externalAction={g.link ? { label: g.linkLabel, onClick: () => navigate(g.link) } : null}
        />
      ))}
      <div className="declare-cta-wrap">
        <button type="button" className="declare-cta" disabled>
          Declare GL closed for April 2025
        </button>
        <span className="declare-cta-hint">GL close declaration ships with the GL Close PRD (forthcoming).</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════
export default function CloseManagementPage() {
  const navigate = useNavigate();
  const { bills } = useBills();
  const { closedThrough, declareClose, history } = useClosePeriod();
  const { hasLevel } = useCurrentUser();
  // Only FM/Admin operate Close (declare, book/skip accruals). Everyone else
  // sees the full board read-only — Close readiness depends on all roles' work,
  // but the declaration and accrual decisions are FM/Admin's.
  const canOperate = hasLevel("ap", "approve+post");

  // Module tab
  const [moduleTab, setModuleTab] = useState("ap");
  // Period selector — current is interactive, priors are read-only
  const [selectedPeriod, setSelectedPeriod] = useState(CLOSE_PERIOD);
  // Declare-close confirmation modal
  const [declareOpen, setDeclareOpen] = useState(false);
  const [declareGates, setDeclareGates] = useState(null);
  // Accrual candidate state lifted from ApGates so the combined progress bar
  // at the page level reflects up-to-date Gate 5 status.
  const [bookedIds, setBookedIds] = useState(() => new Set());
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const handleBook = (id) => setBookedIds((prev) => new Set(prev).add(id));
  const handleDismiss = (id) => setDismissedIds((prev) => new Set(prev).add(id));

  // Is the selected period locked?
  const apLocked = selectedPeriod <= closedThrough;
  const periodLockedAt = useMemo(() => {
    const h = history.find((x) => x.period === selectedPeriod);
    return h?.declared_at || null;
  }, [history, selectedPeriod]);

  const selectedPeriodLabel = PRIOR_PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label || CLOSE_PERIOD_LABEL;

  // ── Compute all three module summaries (used by both the children and
  // the combined progress bar) ─────────────────────────────────────────
  const apState = useMemo(() => computeApGateSummary(bills, bookedIds, dismissedIds), [bills, bookedIds, dismissedIds]);
  const glGates = useMemo(() => computeGlGateSummary(), []);
  // When AP is locked, treat every AP gate as effectively GREEN for the bar.
  const apGatesForBar = apLocked
    ? apState.summary.map((g) => ({ ...g, status: "GREEN" }))
    : apState.summary;
  const combinedModules = [
    { key: "ap", label: "AP", gates: apGatesForBar, locked: apLocked, mocked: false },
    { key: "ar", label: "AR", gates: AR_GATE_SUMMARY, locked: false, mocked: true },
    { key: "gl", label: "GL", gates: glGates, locked: false, mocked: true },
  ];
  const allClosed = combinedModules.every((m) => m.gates.every((g) => g.status === "GREEN"));

  function handleDeclareClose(gates) {
    setDeclareGates(gates);
    setDeclareOpen(true);
  }
  function handleConfirmDeclare() {
    declareClose({
      period: selectedPeriod,
      periodLabel: selectedPeriodLabel,
      gateSnapshot: {
        gate_1: declareGates.find((g) => g.number === 1)?.summary,
        gate_2: declareGates.find((g) => g.number === 2)?.summary,
        gate_3a: 0,
        gate_3b: 0,
        gate_4: declareGates.find((g) => g.number === 4)?.summary,
        gate_5: declareGates.find((g) => g.number === 5)?.summary,
      },
    });
    setDeclareOpen(false);
  }

  return (
    <div className="lg-page close-page">
      <div className="lg-scroll-container">

        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="lg-head close-head-shell">
          <div className="close-breadcrumb">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 3 5 7 9 11" />
            </svg>
            <span>Close periods</span>
          </div>
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">Close Command Center</h1>
              <p className="close-page-sub">
                Close is a state, not an event. When all gates are green, the period can be declared closed — no checklist to manage.
              </p>
            </div>
            <div className="lg-head-actions close-period-select-wrap">
              <label className="close-period-label" htmlFor="close-period-select">Period</label>
              <select
                id="close-period-select"
                className="close-period-select"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {PRIOR_PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}{p.interactive ? "" : " · closed"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Combined progress bar — one segmented bar covering all 3 modules */}
          <CombinedProgressBar
            modules={combinedModules}
            periodLabel={selectedPeriodLabel}
            allClosed={allClosed}
          />

          {/* Module tabs */}
          <div className="close-module-tabs">
            <button
              type="button"
              className={`close-module-tab${moduleTab === "ap" ? " active" : ""}`}
              onClick={() => setModuleTab("ap")}
            >
              Accounts Payable
              {apLocked && <span className="close-module-tab-lock" title="AP closed">{I.lock}</span>}
            </button>
            <button
              type="button"
              className={`close-module-tab${moduleTab === "ar" ? " active" : ""}`}
              onClick={() => setModuleTab("ar")}
            >
              Accounts Receivable
              <span className="close-module-tab-mock" title="Mocked — AR PRD in flight">mock</span>
            </button>
            <button
              type="button"
              className={`close-module-tab${moduleTab === "gl" ? " active" : ""}`}
              onClick={() => setModuleTab("gl")}
            >
              General Ledger
              <span className="close-module-tab-mock" title="Mocked — GL PRD in flight">mock</span>
            </button>
          </div>
        </div>

        {/* ── Module tab content ───────────────────────────────────── */}
        <div className="close-tab-content">
          {moduleTab === "ap" && (
            <ApGates
              bills={bills}
              navigate={navigate}
              onDeclareClose={handleDeclareClose}
              periodLabel={selectedPeriodLabel}
              locked={apLocked}
              lockedAt={periodLockedAt}
              apState={apState}
              bookedIds={bookedIds}
              dismissedIds={dismissedIds}
              onBook={handleBook}
              onDismiss={handleDismiss}
              canOperate={canOperate}
            />
          )}
          {moduleTab === "ar" && <ArGates navigate={navigate} gates={AR_GATE_SUMMARY} />}
          {moduleTab === "gl" && <GlGates navigate={navigate} gates={glGates} />}
        </div>

        {/* ── Close history ────────────────────────────────────────── */}
        <div className="close-history-wrap">
          <div className="close-history-head">Close history</div>
          <div className="close-history-list">
            {history.map((h) => (
              <div key={h.period} className="close-history-row">
                <span className="close-history-period">{h.period_label}</span>
                <span className="close-history-detail">
                  Declared {formatDeclTime(h.declared_at)} by {h.declared_by}
                  {h.days_after_period_end != null && <span className="close-history-velocity"> · {h.days_after_period_end}d after period end</span>}
                  {h.reopened_at && <span className="close-history-reopened"> · reopened {formatDeclTime(h.reopened_at)} ({h.reopen_reason})</span>}
                </span>
                <button type="button" className="close-history-link" onClick={() => setSelectedPeriod(h.period)}>
                  View snapshot {I.ext}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DeclareCloseModal
        open={declareOpen}
        period={selectedPeriod}
        periodLabel={selectedPeriodLabel}
        gates={declareGates || []}
        onConfirm={handleConfirmDeclare}
        onCancel={() => setDeclareOpen(false)}
      />
    </div>
  );
}
