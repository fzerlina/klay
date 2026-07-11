import { useMemo } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useCurrentUser } from "../state/CurrentUserContext";
import { useBills } from "../state/BillsContext";
import { useInvoices } from "../state/InvoicesContext";
import { useJournalEntries } from "../state/JournalEntriesContext";
import { usePayments } from "../state/PaymentsContext";
import { useClosePeriod } from "../state/ClosePeriodContext";
import { ROLES } from "../data/seed/roles";
import { buildAgingLines } from "../lib/apAging";
import { computeHomeTasks } from "../lib/homeTasks";
import { formatRupiah, formatDateEn } from "../lib/format";
import { TODAY } from "../lib/clock";
import "./home.css";

const SEV_META = {
  blocking: { label: "Blocking", tone: "danger" },
  action:   { label: "Needs action", tone: "action" },
  advisory: { label: "Advisory", tone: "advisory" },
};

function primaryRoleLabel(roleKeys = []) {
  const names = roleKeys.map((k) => ROLES.find((r) => r.key === k)?.name || k);
  if (names.length === 0) return "No role";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function SparkleIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
      <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
    </svg>
  );
}

function TaskCard({ task, onOpen }) {
  return (
    <button type="button" className="hm-task" data-sev={task.severity} onClick={onOpen}>
      <span className="hm-task-rail" aria-hidden />
      <span className="hm-task-count">{task.count}</span>
      <span className="hm-task-body">
        <span className="hm-task-lbl-row">
          <span className="hm-task-lbl">{task.label}</span>
          {task.tag && <span className="hm-task-tag" data-tone={task.tag.tone}>{task.tag.text}</span>}
        </span>
        <span className="hm-task-sub">{task.sub}</span>
      </span>
      <span className="hm-task-tail">
        {task.amount ? <span className="hm-task-amt">{formatRupiah(task.amount)}</span> : null}
        <span className="hm-task-cta">{task.cta} →</span>
      </span>
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, hasCapability } = useCurrentUser();
  const { bills } = useBills();
  const { invoices } = useInvoices();
  const { entries } = useJournalEntries();
  const { statusOf } = usePayments();
  const { closedThrough, autoAssignLateBills } = useClosePeriod();

  const agingLines = useMemo(() => buildAgingLines(TODAY, bills), [bills]);

  const hub = useMemo(
    () => computeHomeTasks({
      bills, invoices, entries, agingLines,
      paymentStatusOf: statusOf,
      closedThrough, autoAssignLateBills,
      hasCapability,
    }),
    [bills, invoices, entries, agingLines, statusOf, closedThrough, autoAssignLateBills, hasCapability],
  );

  const firstName = (user.name || "").trim().split(/\s+/)[0] || "there";
  const roleLabel = primaryRoleLabel(user.roleKeys);
  const { taskCount, groupCount, groups, bySeverity } = hub;
  const s = (n) => (n === 1 ? "" : "s");

  const lede = taskCount > 0
    ? <>You have <strong>{taskCount}</strong> open task{s(taskCount)} across <strong>{groupCount}</strong> area{s(groupCount)}.{bySeverity.blocking > 0 ? " Start with anything marked blocking." : ""}</>
    : <>You're all caught up — nothing needs your attention right now.</>;

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ─────────────────────────────────────────── */}
        <div className="lg-head hm-head">
          <div className="hm-head-top">
            <div className="hm-head-id">
              <div className="hm-eyebrow"><SparkleIcon /> {roleLabel} · {formatDateEn(TODAY.toISOString().slice(0, 10))}</div>
              <h1 className="lg-title">Welcome back, {firstName}</h1>
              <p className="hm-lede">{lede}</p>
            </div>
            <div className="hm-head-tally" aria-hidden={taskCount === 0}>
              <span className="hm-tally-num">{taskCount}</span>
              <span className="hm-tally-lbl">open task{s(taskCount)}</span>
            </div>
          </div>

          {/* Severity strip — quantifies the workload by urgency. */}
          <div className="hm-sev-strip">
            {["blocking", "action", "advisory"].map((k) => (
              <div key={k} className="hm-sev-cell" data-tone={SEV_META[k].tone} data-empty={bySeverity[k] === 0}>
                <span className="hm-sev-dot" aria-hidden />
                <span className="hm-sev-num">{bySeverity[k]}</span>
                <span className="hm-sev-lbl">{SEV_META[k].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Task groups ──────────────────────────────────────────────── */}
        <div className="hm-body">
          {groups.length === 0 ? (
            <div className="hm-empty">
              <div className="hm-empty-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div className="hm-empty-title">All clear</div>
              <div className="hm-empty-sub">No open tasks for your role. New work across Bills, Invoices, the ledger, and close will surface here automatically.</div>
            </div>
          ) : (
            groups.map((g) => {
              const gItems = g.tasks.reduce((a, t) => a + t.count, 0);
              return (
                <section key={g.key} className="hm-group">
                  <header className="hm-group-head">
                    <span className="hm-group-title">{g.label}</span>
                    <span className="hm-group-count">{gItems}</span>
                    <NavLink to={g.to} className="hm-group-open">Open {g.label} →</NavLink>
                  </header>
                  <div className="hm-tasklist">
                    {g.tasks.map((t) => (
                      <TaskCard key={t.id} task={t} onOpen={() => navigate(t.to)} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
