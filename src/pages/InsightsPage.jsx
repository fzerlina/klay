import { useMemo } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useCurrentUser } from "../state/CurrentUserContext";
import { useBills } from "../state/BillsContext";
import { useInvoices } from "../state/InvoicesContext";
import { buildAgingLines } from "../lib/apAging";
import { computeHomeInsights } from "../lib/homeInsights";
import { formatDateEn } from "../lib/format";
import { TODAY } from "../lib/clock";
import "./home.css";
import "./insights.css";

function SparkleIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
      <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
    </svg>
  );
}

function InsightCard({ insight, onOpen }) {
  return (
    <button type="button" className="ins-card" data-tone={insight.tone} onClick={onOpen}>
      <span className="ins-rail" aria-hidden />
      <span className="ins-head">
        <span className="ins-headline">{insight.headline}</span>
        <span className="ins-label">{insight.label}</span>
      </span>
      <span className="ins-detail">{insight.detail}</span>
      <span className="ins-cta">{insight.cta} →</span>
    </button>
  );
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const { user, can } = useCurrentUser();
  const { bills } = useBills();
  const { invoices } = useInvoices();

  const agingLines = useMemo(() => buildAgingLines(TODAY, bills), [bills]);
  const hub = useMemo(
    () => computeHomeInsights({ agingLines, invoices, can }),
    [agingLines, invoices, can],
  );

  const { count, groupCount, groups } = hub;
  const s = (n) => (n === 1 ? "" : "s");
  const lede = count > 0
    ? <>What the data shows right now — <strong>{count}</strong> insight{s(count)} across <strong>{groupCount}</strong> area{s(groupCount)}. Each links back into the ledger.</>
    : <>No insights surfaced for your role right now. As Bills, Invoices, and the ledger fill up, patterns appear here.</>;

  return (
    <div className="lg-page">
      <div className="lg-scroll-container">
        {/* ── Editorial header ─────────────────────────────────────────── */}
        <div className="lg-head hm-head">
          <div className="hm-head-top">
            <div className="hm-head-id">
              <div className="hm-eyebrow"><SparkleIcon /> Insights · {formatDateEn(TODAY.toISOString().slice(0, 10))}</div>
              <h1 className="lg-title">Insights</h1>
              <p className="hm-lede">{lede}</p>
            </div>
            <div className="hm-head-tally" aria-hidden={count === 0}>
              <span className="hm-tally-num">{count}</span>
              <span className="hm-tally-lbl">insight{s(count)}</span>
            </div>
          </div>
        </div>

        {/* ── Insight groups ───────────────────────────────────────────── */}
        <div className="hm-body">
          {groups.length === 0 ? (
            <div className="hm-empty">
              <div className="hm-empty-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div className="hm-empty-title">Nothing to surface yet</div>
              <div className="hm-empty-sub">Analytics for the modules you can access will appear here as their data grows.</div>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="hm-group">
                <header className="hm-group-head">
                  <span className="hm-group-title">{g.label}</span>
                  <span className="hm-group-count">{g.insights.length}</span>
                  <NavLink to={g.to} className="hm-group-open">Open {g.label} →</NavLink>
                </header>
                <div className="ins-grid">
                  {g.insights.map((i) => (
                    <InsightCard key={i.id} insight={i} onOpen={() => navigate(i.to)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
