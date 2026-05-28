import { useEffect } from "react";

const SparkleIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
    <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
  </svg>
);

// Right-side drawer that lists today's insights / tasks.
//   mode="ai"    → clicking a card forwards the question to the AI chat drawer
//   mode="tasks" → clicking a card hands the insight to onPick (which typically
//                  filters the table to that insight's subset)
export default function SummaryDrawer({
  open,
  onClose,
  insights,
  onAsk,
  onPick,
  mode = "ai",
  title = "Today's Insights",
  ctaLabel = "Ask AI",
  contextLabel = "Invoices",
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handlePick = (it) => {
    if (mode === "tasks" && onPick) onPick(it);
    else if (onAsk) onAsk(it.question);
  };

  return (
    <aside className={`summary-drawer${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="summary-dh">
        <div className="summary-dh-icon">
          <SparkleIcon size={14} />
        </div>
        <div className="summary-dh-body">
          <div className="summary-dh-title">{title}</div>
          <div className="summary-dh-meta">
            {insights.length} {mode === "tasks" ? (insights.length === 1 ? "task" : "tasks") : (insights.length === 1 ? "insight" : "insights")} · updated by Klay AI
          </div>
        </div>
        <button className="ai-dh-btn" title="Close" onClick={onClose}>
          <svg viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="summary-list">
        {insights.map((it, i) => (
          <button
            key={it.id}
            type="button"
            className="summary-card"
            onClick={() => handlePick(it)}
          >
            <div className="summary-card-num">{String(i + 1).padStart(2, "0")}</div>
            <div className="summary-card-body">
              <div className="summary-card-text">{it.node}</div>
              {mode === "tasks" ? (
                <div className="summary-card-cta summary-card-cta-task">
                  {ctaLabel}
                  <span className="summary-card-arrow">→</span>
                </div>
              ) : (
                <div className="summary-card-cta">
                  <SparkleIcon size={9} />
                  {ctaLabel}: <em>"{it.question}"</em>
                  <span className="summary-card-arrow">→</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="summary-foot">
        <span>Klay AI · {contextLabel} context · haiku-4-5</span>
      </div>
    </aside>
  );
}
