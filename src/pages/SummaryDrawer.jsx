import { useEffect } from "react";

const SparkleIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
    <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
  </svg>
);

// Right-side drawer that lists today's insights. Each card is clickable —
// clicking forwards the question to the AI chat drawer.
export default function SummaryDrawer({ open, onClose, insights, onAsk }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside className={`summary-drawer${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="summary-dh">
        <div className="summary-dh-icon">
          <SparkleIcon size={14} />
        </div>
        <div className="summary-dh-body">
          <div className="summary-dh-title">Summary Days Ini</div>
          <div className="summary-dh-meta">{insights.length} insight · diperbarui oleh Klay AI</div>
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
            onClick={() => onAsk(it.question)}
          >
            <div className="summary-card-num">{String(i + 1).padStart(2, "0")}</div>
            <div className="summary-card-body">
              <div className="summary-card-text">{it.node}</div>
              <div className="summary-card-cta">
                <SparkleIcon size={9} />
                Tanya AI: <em>"{it.question}"</em>
                <span className="summary-card-arrow">→</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="summary-foot">
        <span>Klay AI · konteks: Invoices · haiku-4-5</span>
      </div>
    </aside>
  );
}
