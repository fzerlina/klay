import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ACCOUNTS as BANK_ACCOUNTS, INITIAL_TRANSACTIONS as BANK_TRANSACTIONS } from "./BankReconciliationPage";
import { JOURNAL_ENTRIES as SEED_JOURNAL_ENTRIES } from "../data/seed/journalEntries";
import "./modules.css";
import "./invoices-ledger.css";
import "./close.css";

const PERIOD_LABEL = "April 2025";
const TARGET_CLOSE = "24 Apr 2025";
const DAYS_TO_CLOSE = 2;
const TODAY_LABEL = "as of Apr 22, 2025";

// Who reviews each task. Klay implicitly preps all 10.
const TASK_OWNERS = {
  "bank-unmatched":   "sarah",
  "ar-aging":         "sarah",
  "ap-aging":         "budi",
  "anomalies":        "budi",
  "pending-jes":      "budi",
  "depreciation":     "andi",
  "prepaid":          "sarah",
  "payroll":          "sarah",
};
const HUMAN_REVIEWERS = [
  { key: "sarah", name: "Sarah Wijaya",  initials: "SW" },
  { key: "budi",  name: "Budi Santoso",  initials: "BS" },
  { key: "andi",  name: "Andi Prasetyo", initials: "AP" },
];

// Single source of truth for bank-rec stats — derived from the real
// Bank Reconciliation page data so the two pages always tally.
const RECON_STATS = (() => {
  const totalAccounts = BANK_ACCOUNTS.length;
  const statementsUploaded = BANK_ACCOUNTS.filter(
    (a) => a.statementPeriod && a.statementPeriod !== "no statement yet",
  ).length;
  let matched = 0, autoPending = 0, toMatch = 0;
  for (const acctId of Object.keys(BANK_TRANSACTIONS)) {
    for (const t of BANK_TRANSACTIONS[acctId]) {
      if (t.status === "matched") matched++;
      else if (t.status === "auto") autoPending++;
      else if (t.status === "to-match") toMatch++;
    }
  }
  const totalTransactions = matched + autoPending + toMatch;
  // Auto + matched are both Klay-handled (one auto-applied, one pending sign-off)
  const klayAutomated = matched + autoPending;
  const automationPct = totalTransactions
    ? Math.round((klayAutomated / totalTransactions) * 100)
    : 0;
  return { totalAccounts, statementsUploaded, totalTransactions, matched, autoPending, toMatch, klayAutomated, automationPct };
})();

// JE stats — single source of truth for the "Journal entries to post" bucket.
// The Klay-attributed draft count (8 invoices + 2 recurring = 10) is what
// Klay surfaced; the rest are manual user drafts still awaiting work.
const JE_STATS = (() => {
  // Computed from the static seed at module load — Close Management's draft
  // count doesn't need to react to posted bills in the demo (posting creates
  // a 'posted' JE, not a 'draft', so this count stays accurate).
  const drafts = SEED_JOURNAL_ENTRIES.filter((j) => j.status === "draft").length;
  const klayDrafts = 10; // 8 from invoices/bills + 2 from recurring templates
  return { drafts, klayDrafts, manualDrafts: Math.max(0, drafts - klayDrafts) };
})();

const HUMANS_BY_KEY = Object.fromEntries(HUMAN_REVIEWERS.map((r) => [r.key, r]));

// Inline sparkle icon — matches the Invoices/Bills/GL pattern.
function SparkleIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5l1.1 2.7L9.8 5l-2.7 0.8L6 8.5l-1.1-2.7L2.2 5l2.7-0.8L6 1.5z" />
      <path d="M10 8.5l0.4 1L11.5 10l-1.1 0.4L10 11.5l-0.4-1.1L8.5 10l1.1-0.5L10 8.5z" />
    </svg>
  );
}

// ── Sub-task data (granular checklist for All Tasks tab) ────────────────
// Each row is an atomic close-checklist item. Buckets above (CLOSE_TASKS) roll up these.
const SUB_TASKS = [
  // Bank reconciliation (7)
  { id: "br-1", title: "BCA Operating · April reconciliation",         category: "Recon",        status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  { id: "br-2", title: "BNI Operating · April reconciliation",         category: "Recon",        status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  { id: "br-3", title: "Mandiri Operating · April reconciliation",     category: "Recon",        status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  { id: "br-4", title: "BCA USD · April reconciliation",               category: "Recon",        status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  { id: "br-5", title: "Match 5 unmatched lines (BCA Operating)",      category: "Recon",        status: "awaiting", assignee: "sarah", reviewer: null,    due: "Apr 23" },
  { id: "br-6", title: "Upload BCA Petty Cash statement",              category: "Recon",        status: "awaiting", assignee: "sarah", reviewer: null,    due: "Apr 23" },
  { id: "br-7", title: "Verify FX rate · USD/SGD/EUR",                 category: "Recon",        status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  // Anomalies (4)
  { id: "an-1", title: "Duplicate entry: BCA #2398",                   category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 23" },
  { id: "an-2", title: "Unusual amount: PT XYZ vendor Rp 47M",         category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 23" },
  { id: "an-3", title: "Backdated invoice: INV-1042",                  category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 23" },
  { id: "an-4", title: "Missing tax code: JE-2042",                    category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 23" },
  // JEs to post (10)
  { id: "je-1",  title: "Confirm JE: BILL-2398 (Klay draft)",          category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-2",  title: "Confirm JE: BILL-2399 (Klay draft)",          category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-3",  title: "Confirm JE: BILL-2401 (Klay draft)",          category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-4",  title: "Confirm JE: INV-1041 (Klay draft)",           category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-5",  title: "Confirm JE: INV-1042 (Klay draft)",           category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-6",  title: "Confirm JE: INV-1044 (Klay draft)",           category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-7",  title: "Confirm JE: VND-507 (Klay draft)",            category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-8",  title: "Confirm JE: VND-508 (Klay draft)",            category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-9",  title: "Approve recurring: Office rent April",        category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  { id: "je-10", title: "Approve recurring: SaaS subscription accrual", category: "Journal Entry", status: "awaiting", assignee: "klay",  reviewer: "budi",  due: "Apr 24" },
  // AR / AP aging (2)
  { id: "ar-1", title: "AR aging · 84 customer balances reconciled",   category: "Recon",        status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  { id: "ap-1", title: "AP aging · 47 vendor balances reconciled",     category: "Recon",        status: "done",     assignee: "klay",  reviewer: "budi",  due: "Apr 22" },
  // Depreciation / Prepaid / Payroll (3)
  { id: "dp-1", title: "April depreciation · 47 fixed assets",         category: "Accruals",     status: "done",     assignee: "klay",  reviewer: "andi",  due: "Apr 22" },
  { id: "pp-1", title: "April prepaid amortization · 12 balances",     category: "Accruals",     status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
  { id: "py-1", title: "April payroll accrual",                        category: "Accruals",     status: "done",     assignee: "klay",  reviewer: "sarah", due: "Apr 22" },
];

// Per-id route overrides; everything else maps by category.
// JE deep-links include ?tab= so the JE page lands on the right view.
const SUB_TASK_ROUTE_OVERRIDES = {
  "ar-1": "/customers",
  "ap-1": "/vendors",
  // Anomalies → JE Anomaly tab
  "an-1": "/journal-entry?tab=anomaly",
  "an-2": "/journal-entry?tab=anomaly",
  "an-3": "/journal-entry?tab=anomaly",
  "an-4": "/journal-entry?tab=anomaly",
  // Klay-drafted JEs → JE Draft tab
  "je-1":  "/journal-entry?tab=draft",
  "je-2":  "/journal-entry?tab=draft",
  "je-3":  "/journal-entry?tab=draft",
  "je-4":  "/journal-entry?tab=draft",
  "je-5":  "/journal-entry?tab=draft",
  "je-6":  "/journal-entry?tab=draft",
  "je-7":  "/journal-entry?tab=draft",
  "je-8":  "/journal-entry?tab=draft",
  "je-9":  "/journal-entry?tab=draft",
  "je-10": "/journal-entry?tab=draft",
  // Done accrual JEs → JE Posted tab
  "dp-1": "/journal-entry?tab=posted",
  "pp-1": "/journal-entry?tab=posted",
  "py-1": "/journal-entry?tab=posted",
};
const SUB_TASK_CATEGORY_ROUTES = {
  "Recon":         "/bank-reconciliation",
  "Journal Entry": "/journal-entry",
  "Accruals":      "/journal-entry",
};
function subTaskRoute(item) {
  return SUB_TASK_ROUTE_OVERRIDES[item.id] || SUB_TASK_CATEGORY_ROUTES[item.category];
}

// ── Helpers used by the All Tasks table ─────────────────────────────────
function StatusBadge({ status }) {
  if (status === "done") {
    return (
      <span className="task-tbl-status done" title="Done" aria-label="Done">
        <svg viewBox="0 0 10 10"><polyline points="2 5 4 7 8 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    );
  }
  if (status === "working") return <span className="task-tbl-status working" title="Klay still working" aria-label="Klay still working" />;
  return <span className="task-tbl-status awaiting" title="Reviewed by Klay · awaiting you" aria-label="Reviewed by Klay, awaiting you" />;
}

function AvatarCell({ who }) {
  if (!who) return <span className="task-tbl-empty">—</span>;
  if (who === "klay") {
    return (
      <span className="task-tbl-avatar klay" title="Klay AI">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z"/>
        </svg>
      </span>
    );
  }
  const h = HUMANS_BY_KEY[who];
  return <span className="task-tbl-avatar" title={h?.name}>{h?.initials || who.slice(0, 2).toUpperCase()}</span>;
}

function TaskTable({ tasks }) {
  const navigate = useNavigate();
  const ORDER = { awaiting: 0, working: 1, done: 2 };
  const sorted = [...tasks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return (
    <div className="lg-card lg-table-close-tasks">
      <div className="lg-col-header">
        <div>Status</div>
        <div>Task</div>
        <div>Category</div>
        <div>Assignee</div>
        <div>Reviewer</div>
        <div>Due</div>
        <div aria-hidden></div>
      </div>
      {sorted.map((t) => {
        const route = subTaskRoute(t);
        return (
          <div
            key={t.id}
            className={`lg-row task-tbl-row task-tbl-${t.status}`}
            onClick={() => route && navigate(route)}
            role={route ? "link" : undefined}
            tabIndex={route ? 0 : undefined}
            onKeyDown={(e) => { if (route && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); navigate(route); } }}
          >
            <div><StatusBadge status={t.status} /></div>
            <div className="task-tbl-title">{t.title}</div>
            <div><span className="task-tbl-cat">{t.category}</span></div>
            <div><AvatarCell who={t.assignee} /></div>
            <div><AvatarCell who={t.reviewer} /></div>
            <div className="task-tbl-due">{t.due}</div>
            <div className="task-tbl-chevron" aria-hidden>
              <svg viewBox="0 0 12 12"><polyline points="4 2 8 6 4 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress card (simplified: headline + bar + legend) ────────────────
function ProgressCard({ counts }) {
  const { total, done, awaiting, working } = counts;
  const donePct     = total ? (done / total) * 100 : 0;
  const awaitingPct = total ? (awaiting / total) * 100 : 0;
  const workingPct  = total ? (working / total) * 100 : 0;
  const overallPct  = Math.round(donePct);

  return (
    <div className="close-card progress-card">
      <div className="progress-body">
        <div className="progress-headline-row">
          <div className="progress-headline">
            <span className="progress-headline-num">{done}</span>
            <span className="progress-headline-of">/ {total} tasks complete</span>
          </div>
          <div className="progress-headline-pct">{overallPct}%</div>
        </div>

        <div className="progress-funnel-bar" role="img" aria-label={`${done} done, ${awaiting} reviewed by Klay (awaiting you), ${working} Klay still working`}>
          {done > 0 && <div className="progress-funnel-seg done" style={{ width: donePct + "%" }} />}
          {awaiting > 0 && <div className="progress-funnel-seg awaiting" style={{ width: awaitingPct + "%" }} />}
          {working > 0 && <div className="progress-funnel-seg working" style={{ width: workingPct + "%" }} />}
        </div>

        <div className="progress-legend">
          <span className="progress-legend-item">
            <span className="progress-legend-dot done" />
            Done <strong>{done}</strong>
          </span>
          <span className="progress-legend-item">
            <span className="progress-legend-dot awaiting" />
            Reviewed by Klay <strong>{awaiting}</strong>
          </span>
          <span className="progress-legend-item">
            <span className="progress-legend-dot working" />
            Klay still working <strong>{working}</strong>
          </span>
        </div>

        <div className="progress-ai-callout">
          <SparkleIcon />
          <span>
            Klay automated <strong>{RECON_STATS.klayAutomated} of {RECON_STATS.totalTransactions} bank transactions</strong>
            {" "}({RECON_STATS.automationPct}%) this period · {RECON_STATS.toMatch} surfaced for your review
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Per-assignee list (rendered on All Tasks tab) ──────────────────────
function PerAssigneeCard({ assignees, total }) {
  return (
    <div className="close-card">
      <div className="close-card-head">
        <div className="close-card-title">
          Per assignee
          <span className="close-card-sub">· {total} tasks</span>
        </div>
      </div>
      <div className="progress-assignees">
        {assignees.map((a) => {
          const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
          return (
            <div key={a.name} className="progress-assignee-row">
              <span className={`progress-assignee-av${a.klay ? " klay" : ""}`}>
                {a.klay ? (
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
                  </svg>
                ) : (a.initials || a.name.slice(0, 2))}
              </span>
              <span className="progress-assignee-name">{a.name}</span>
              <div className="progress-bar-track sm">
                <div className={`progress-bar-fill${a.klay ? " brand" : " action"}`} style={{ width: pct + "%" }} />
              </div>
              <span className="progress-assignee-val">{a.done}/{a.total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Donut: 3-segment ring (done / prepped / todo) ──────────────────────
function TaskDonut({ counts }) {
  const { total, done, prepped, todo } = counts;
  const R = 18;
  const C = 2 * Math.PI * R;
  if (!total) return null;
  const doneLen    = (done    / total) * C;
  const preppedLen = (prepped / total) * C;
  const todoLen    = (todo    / total) * C;
  return (
    <svg viewBox="0 0 50 50" className="task-donut" aria-hidden>
      <circle cx="25" cy="25" r={R} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="6"/>
      {done > 0 && (
        <circle cx="25" cy="25" r={R} fill="none" stroke="var(--color-success-text)" strokeWidth="6"
          strokeDasharray={`${doneLen} ${C - doneLen}`} transform="rotate(-90 25 25)"/>
      )}
      {prepped > 0 && (
        <circle cx="25" cy="25" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="6"
          strokeDasharray={`${preppedLen} ${C - preppedLen}`}
          strokeDashoffset={-doneLen}
          transform="rotate(-90 25 25)"/>
      )}
      {todo > 0 && (
        <circle cx="25" cy="25" r={R} fill="none" stroke="var(--color-border-strong)" strokeWidth="6"
          strokeDasharray={`${todoLen} ${C - todoLen}`}
          strokeDashoffset={-(doneLen + preppedLen)}
          transform="rotate(-90 25 25)"/>
      )}
    </svg>
  );
}

// ── Task row (donut + title/cat/CTA + Klay summary + 3 counts) ─────────
function TaskRow({ item, status, onAction }) {
  const { counts } = item;
  const detail = status === "done" ? item.doneLine : item.awaitingLine;
  const ctaLabel = status === "done" ? "Review →" : item.action;
  const ctaClass = status === "done" ? "task-row-review-link" : "task-row-cta";
  return (
    <div className={`task-row task-${status}`}>
      <div className="task-row-donut-wrap">
        <TaskDonut counts={counts} />
      </div>
      <div className="task-row-body">
        <div className="task-row-top">
          <h3 className="task-row-title">{item.title}</h3>
          <span className="task-row-cat">{item.category}</span>
          {ctaLabel && (
            <button type="button" className={ctaClass} onClick={onAction}>
              {ctaLabel}
            </button>
          )}
        </div>
        <div className="je-desc-ai task-row-klay">
          <SparkleIcon />
          <span className="je-desc-ai-text">
            {item.klayLine}{detail ? ` · ${detail}` : ""}
          </span>
        </div>
        <div className="task-row-counts">
          <span className="task-count count-done"><span className="count-dot"/>{counts.done} done</span>
          <span className="task-count count-prepped"><span className="count-dot"/>{counts.prepped} prepped</span>
          <span className="task-count count-todo"><span className="count-dot"/>{counts.todo} to do</span>
        </div>
      </div>
    </div>
  );
}

export default function CloseManagementPage() {
  const navigate = useNavigate();
  const [resolved, setResolved] = useState(() => new Set());
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState("overview"); // "overview" | "all-tasks"
  const [toast, setToast] = useState("");
  const toastTmr = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTmr.current) clearTimeout(toastTmr.current);
    toastTmr.current = setTimeout(() => setToast(""), 1800);
  }

  // ── Close-task data ────────────────────────────────────────────────────
  // Single flat list. Each task is a bucket of sub-items with done/prepped/todo counts.
  const CLOSE_TASKS = useMemo(() => [
    {
      id: "bank-unmatched",
      title: "Bank reconciliation",
      category: "Recon",
      klayLine: `${RECON_STATS.statementsUploaded}/${RECON_STATS.totalAccounts} statements uploaded · Klay matched ${RECON_STATS.matched}/${RECON_STATS.totalTransactions} transaction lines`,
      status: "awaiting",
      counts: {
        total: RECON_STATS.totalTransactions,
        done: RECON_STATS.matched,
        prepped: RECON_STATS.autoPending,
        todo: RECON_STATS.toMatch,
      },
      awaitingLine: `${RECON_STATS.toMatch} unmatched · ${RECON_STATS.autoPending} awaiting confirmation · ${RECON_STATS.totalAccounts - RECON_STATS.statementsUploaded} statement pending upload`,
      action: `Review ${RECON_STATS.toMatch + RECON_STATS.autoPending} →`,
      doneLine: `All ${RECON_STATS.totalTransactions} matched · Ties to GL`,
    },
    {
      id: "anomalies",
      title: "Anomalies flagged",
      category: "Journal Entry",
      klayLine: "Klay scanned 384 entries for unusual patterns",
      status: "awaiting",
      counts: { total: 384, done: 380, prepped: 4, todo: 0 },
      awaitingLine: "4 anomalies flagged",
      action: "Review 4 →",
      doneLine: "All anomalies cleared",
    },
    {
      id: "pending-jes",
      title: "Journal entries to post",
      category: "Journal Entry",
      klayLine: `Klay drafted 8 from invoices/bills · 2 from recurring templates · ${JE_STATS.manualDrafts} manual drafts`,
      status: "awaiting",
      counts: { total: JE_STATS.drafts, done: 0, prepped: JE_STATS.klayDrafts, todo: JE_STATS.manualDrafts },
      awaitingLine: `${JE_STATS.drafts} drafts pending posting`,
      action: `Review ${JE_STATS.drafts} →`,
      doneLine: `All ${JE_STATS.drafts} posted`,
    },
    {
      id: "ar-aging",
      title: "AR aging",
      category: "Recon",
      klayLine: "Klay reconciled 84 customer balances",
      status: "done",
      counts: { total: 84, done: 84, prepped: 0, todo: 0 },
      doneLine: "Ties to GL · Rp 1.42B",
    },
    {
      id: "ap-aging",
      title: "AP aging",
      category: "Recon",
      klayLine: "Klay reconciled 47 vendor balances",
      status: "done",
      counts: { total: 47, done: 47, prepped: 0, todo: 0 },
      doneLine: "Ties to GL · Rp 624M",
    },
    {
      id: "depreciation",
      title: "Depreciation",
      category: "Accruals",
      klayLine: "Klay calculated depreciation on 47 fixed assets",
      status: "done",
      counts: { total: 47, done: 47, prepped: 0, todo: 0 },
      doneLine: "Booked · Rp 14.2M",
    },
    {
      id: "prepaid",
      title: "Prepaid amortization",
      category: "Accruals",
      klayLine: "Klay amortized 12 prepaid balances",
      status: "done",
      counts: { total: 12, done: 12, prepped: 0, todo: 0 },
      doneLine: "Booked · Rp 8.7M",
    },
    {
      id: "payroll",
      title: "Payroll accrual",
      category: "Accruals",
      klayLine: "Klay estimated April payroll",
      status: "done",
      counts: { total: 1, done: 1, prepped: 0, todo: 0 },
      doneLine: "Booked · Rp 187M",
    },
  ], []);

  function effectiveStatus(item) {
    if (item.status === "done") return "done";
    if (resolved.has(item.id)) return "done";
    return item.status;
  }
  const STATUS_ORDER = { awaiting: 0, working: 1, done: 2 };
  const sortedTasks = useMemo(
    () => [...CLOSE_TASKS].sort((a, b) => STATUS_ORDER[effectiveStatus(a)] - STATUS_ORDER[effectiveStatus(b)]),
    [CLOSE_TASKS, resolved],
  );

  // ── Live counts + assignee rollup derived from the actual tasks ───────
  const counts = useMemo(() => {
    const total = CLOSE_TASKS.length;
    const done = CLOSE_TASKS.filter((t) => effectiveStatus(t) === "done").length;
    const awaiting = CLOSE_TASKS.filter((t) => effectiveStatus(t) === "awaiting").length;
    const working = CLOSE_TASKS.filter((t) => effectiveStatus(t) === "working").length;
    return { total, done, awaiting, working };
  }, [CLOSE_TASKS, resolved]);

  // Per-assignee rollup is computed against SUB_TASKS (the granular checklist).
  // Klay's "done" is always equal to total — Klay's preparation completes on every assigned task;
  // the remaining wait is on humans, not on Klay.
  const assignees = useMemo(() => {
    const klayCount = SUB_TASKS.filter((t) => t.assignee === "klay").length;
    const klay = { name: "Klay AI", klay: true, done: klayCount, total: klayCount };
    const humans = HUMAN_REVIEWERS.map((r) => {
      const mine = SUB_TASKS.filter((t) => t.assignee === r.key || t.reviewer === r.key);
      return {
        name: r.name,
        initials: r.initials,
        total: mine.length,
        done: mine.filter((t) => t.status === "done").length,
      };
    });
    return [klay, ...humans];
  }, []);

  const totalBlockers = counts.awaiting + counts.working;

  // Each action item links to the dedicated page where the work happens.
  const TASK_ROUTES = {
    "bank-unmatched":   "/bank-reconciliation",
    "ar-aging":         "/customers",
    "ap-aging":         "/vendors",
    "anomalies":        "/journal-entry?tab=anomaly",
    "pending-jes":      "/journal-entry?tab=draft",
    "depreciation":     "/journal-entry?tab=posted",
    "prepaid":          "/journal-entry?tab=posted",
    "payroll":          "/journal-entry?tab=posted",
  };
  function handleTaskAction(id) {
    const route = TASK_ROUTES[id];
    if (route) navigate(route);
  }

  const ready = totalBlockers === 0 && !locked;
  const statusLabel = locked ? "Locked" : ready ? "Ready to close" : "In progress";
  const statusTone  = locked ? "neutral" : ready ? "ok" : "warn";

  return (
    <div className="lg-page close-page">
      <div className="lg-scroll-container">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="lg-head">
          <div className="close-breadcrumb">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 3 5 7 9 11" />
            </svg>
            <span>Close periods</span>
          </div>
          <div className="lg-head-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="lg-title">{PERIOD_LABEL} close</h1>
              <div className="close-status-row">
                <span className={`close-status-pill ${statusTone}`}>
                  {statusTone === "ok" && (
                    <svg viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {statusTone === "warn" && (
                    <span className="close-status-dot" />
                  )}
                  {statusLabel}
                </span>
                <div className="close-status-stat">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="10" height="9" rx="1.2"/><line x1="2" y1="6" x2="12" y2="6"/><line x1="5" y1="1.5" x2="5" y2="4"/><line x1="9" y1="1.5" x2="9" y2="4"/>
                  </svg>
                  <span className="close-status-stat-lbl">Target close</span>
                  <span className="close-status-stat-val">{TARGET_CLOSE}</span>
                </div>
                <div className="close-status-stat">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="7" r="5.5"/><polyline points="7 4 7 7 9.5 8.5"/>
                  </svg>
                  <span className="close-status-stat-lbl">Days to close</span>
                  <span className="close-status-stat-val">{locked ? "—" : `${DAYS_TO_CLOSE} ${DAYS_TO_CLOSE === 1 ? "day" : "days"}`}</span>
                </div>
              </div>
            </div>
            <div className="lg-head-actions">
              <button type="button" className="close-head-btn ghost" onClick={() => showToast("Edit checklist — coming soon")}>
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/><path d="M11 1.5a1.25 1.25 0 0 1 1.75 1.75L7 9l-2.5.5L5 7z"/>
                </svg>
                Edit checklist
              </button>
              <button
                type="button"
                className="close-head-btn ghost"
                disabled={locked}
                onClick={() => {
                  if (!ready) { showToast(`Resolve ${totalBlockers} blockers before locking the period`); return; }
                  setLocked(true);
                  showToast(`${PERIOD_LABEL} locked · books are closed`);
                }}
              >
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="6.5" width="9" height="6" rx="1"/><path d="M4.5 6.5V4a2.5 2.5 0 0 1 5 0v2.5"/>
                </svg>
                {locked ? "Locked" : "Lock period"}
              </button>
              <button type="button" className="close-head-btn primary" onClick={() => showToast("New task — coming soon")}>
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/>
                </svg>
                New task
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="close-tabs">
            <button
              type="button"
              className={`close-tab${tab === "overview" ? " active" : ""}`}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`close-tab${tab === "all-tasks" ? " active" : ""}`}
              onClick={() => setTab("all-tasks")}
            >
              All tasks
              <span className="close-tab-count">{SUB_TASKS.length}</span>
            </button>
          </div>
        </div>

        {tab === "all-tasks" ? (
          <div className="close-all-tasks-wrap">
            <PerAssigneeCard assignees={assignees} total={SUB_TASKS.length} />
            <TaskTable tasks={SUB_TASKS} />
          </div>
        ) : (
        <>
        {/* ── Progress (full-width) ───────────────────────────────────── */}
        <div className="close-progress-wrap">
          <ProgressCard counts={counts} />
        </div>

        {/* ── Flat task list (sorted: Awaiting first, then Done) ──────── */}
        <div className="close-task-list-wrap">
          <div className="close-task-list">
            {sortedTasks.map((item) => (
              <TaskRow
                key={item.id}
                item={item}
                status={effectiveStatus(item)}
                onAction={() => handleTaskAction(item.id)}
              />
            ))}
          </div>
        </div>

        </>
        )}
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
