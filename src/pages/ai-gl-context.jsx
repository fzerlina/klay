import { ChatChip } from "./AiChatDrawer";

function fmtRpShort(n) {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
  return "Rp " + n.toLocaleString("id-ID");
}

// ── Insights (Closing Checklist) ────────────────────────────────────────
//
// GL's "Summary" panel hosts the closing-window checklist. Each insight
// reflects an outstanding item that must clear before the period can lock.

export function computeGlInsights({
  totalDebit,
  totalCredit,
  pendingCount,
  draftCount,
  postedCount,
  anomalyCount,
  matchedCount,
  unmatchedCount,
  daysToClose,
  period,
}) {
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;
  const reconPct = postedCount > 0 ? Math.round((matchedCount / postedCount) * 100) : 0;
  const insights = [];

  // 1. Days to close — top of mind for finance whichger
  insights.push({
    id: "closingWindow",
    node: (
      <>
        <strong className="lg-ai-strong">{daysToClose} days</strong> tersisa before closing{" "}
        {period} — GL{" "}
        {isBalanced ? (
          <span style={{ color: "var(--color-success-text)", fontWeight: 600 }}>balanced</span>
        ) : (
          <span className="lg-ai-danger">unbalanced</span>
        )}
        , {pendingCount} JE pending & {anomalyCount} anomaly masih needs ditindak.
      </>
    ),
    question: "What needs to be resolved before closing?",
  });

  // 2. Balance check
  if (isBalanced) {
    insights.push({
      id: "balanced",
      node: (
        <>
          <strong className="lg-ai-strong">GL balanced</strong> — total debit = credit{" "}
          <strong className="lg-ai-strong">{fmtRpShort(totalDebit)}</strong>.
        </>
      ),
      question: "What total debit & credit this period?",
    });
  } else {
    insights.push({
      id: "unbalanced",
      node: (
        <>
          <strong className="lg-ai-strong">GL unbalanced</strong> — variance{" "}
          <span className="lg-ai-danger">{fmtRpShort(Math.abs(totalDebit - totalCredit))}</span>.
        </>
      ),
      question: "Why is the GL unbalanced?",
    });
  }

  // 3. Reconciliation
  insights.push({
    id: "recon",
    node: (
      <>
        Reconciliation <strong className="lg-ai-strong">{reconPct}%</strong> —{" "}
        {matchedCount} from {postedCount} JE posted matched with bank.{" "}
        {unmatchedCount > 0 && (
          <>
            <span className="lg-ai-danger">{unmatchedCount} unmatched</span> need attention.
          </>
        )}
      </>
    ),
    question: "Show JE that not yet matched to bank",
  });

  // 4. Anomaly
  if (anomalyCount > 0) {
    insights.push({
      id: "anomaly",
      node: (
        <>
          <strong className="lg-ai-strong">{anomalyCount} anomaly</strong> terdeteksi —{" "}
          <span className="lg-ai-danger">needs review</span> before period dikunci.
        </>
      ),
      question: "Detected anomaly details",
    });
  }

  // 5. Pending approval
  if (pendingCount > 0) {
    insights.push({
      id: "pending",
      node: (
        <>
          <strong className="lg-ai-strong">{pendingCount} JE pending</strong> awaiting approval
          finance whichger.
        </>
      ),
      question: "Which JEs are pending approval?",
    });
  }

  // 6. Draft
  if (draftCount > 0) {
    insights.push({
      id: "draft",
      node: (
        <>
          <strong className="lg-ai-strong">{draftCount} draft JE</strong> not yet posted to GL.
        </>
      ),
      question: "Draft Which JE that need posting?",
    });
  }

  return insights;
}

// ── AI chat context ──────────────────────────────────────────────────────

export function makeGlAiContext({
  totalDebit,
  totalCredit,
  pendingCount,
  draftCount,
  postedCount,
  anomalyCount,
  matchedCount,
  unmatchedCount,
  daysToClose,
  period,
  anomalyes = [],
  pendingEntries = [],
  unmatchedEntries = [],
}) {
  const reconPct = postedCount > 0 ? Math.round((matchedCount / postedCount) * 100) : 0;

  const welcome = (
    <p>Hi Sside — I have reviewed your GL for period {period}. How can I help?</p>
  );

  const suggestions = [
    "What needs to be resolved before closing?",
    "Detected anomaly details",
    "Show JE that not yet matched to bank",
    "Which JEs are pending approval?",
  ];

  function makeClosingResponse() {
    const items = [];
    items.push({
      ok: Math.abs(totalDebit - totalCredit) < 1,
      label: "GL balanced",
      sub: `Total debit = credit ${fmtRpShort(totalDebit)}`,
    });
    items.push({
      ok: reconPct >= 95,
      label: `Reconciliation ${reconPct}%`,
      sub: `${matchedCount}/${postedCount} JE posted matched`,
    });
    items.push({
      ok: anomalyCount === 0,
      label: anomalyCount === 0 ? "None anomaly" : `${anomalyCount} anomaly`,
      sub: anomalyCount === 0 ? "All safe" : "Perlu review manual",
    });
    items.push({
      ok: pendingCount === 0,
      label: pendingCount === 0 ? "All JEs decided" : `${pendingCount} JE pending`,
      sub: pendingCount === 0 ? "None that awaiting approval" : "Awaiting approval whichger",
    });
    return {
      role: "ai",
      content: (
        <>
          <p>Closing status {period} — {daysToClose} days tersisa:</p>
          <div className="ai-mini-table">
            {items.map((it, i) => (
              <div className="ai-mini-row" key={i}>
                <div className="ai-mini-av" style={{ background: it.ok ? "var(--color-success-text)" : "var(--color-danger-text)" }}>
                  {it.ok ? "✓" : "!"}
                </div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{it.label}</div>
                  <div className="ai-mini-meta">{it.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Review item not yet selesai</ChatChip>
            <ChatChip>Detail reconciliation</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeAnomalyResponse() {
    if (anomalyes.length === 0) return { role: "ai", content: <p>None anomaly terdeteksi this period.</p> };
    return {
      role: "ai",
      content: (
        <>
          <p><strong>{anomalyes.length} anomaly</strong> terdeteksi:</p>
          <div className="ai-mini-table">
            {anomalyes.slice(0, 5).map((a) => (
              <div className="ai-mini-row" key={a.je_number}>
                <div className="ai-mini-av" style={{ background: "var(--color-warning-text)" }}>!</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{a.je_number}</div>
                  <div className="ai-mini-meta">{a.memo}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Review satu as of satu</ChatChip>
            <ChatChip>Mark all as valid</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makePendingResponse() {
    if (pendingEntries.length === 0) return { role: "ai", content: <p>None JE pending approval.</p> };
    return {
      role: "ai",
      content: (
        <>
          <p><strong>{pendingEntries.length} JE pending</strong> approval:</p>
          <div className="ai-mini-table">
            {pendingEntries.slice(0, 5).map((e) => (
              <div className="ai-mini-row" key={e.je_number}>
                <div className="ai-mini-av">{e.je_number.slice(-3)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{e.je_number}</div>
                  <div className="ai-mini-meta">{e.memo}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Approve all</ChatChip>
            <ChatChip>View detail as of JE</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeUnmatchedResponse() {
    if (unmatchedEntries.length === 0) return { role: "ai", content: <p>All JE matched with bank ✓</p> };
    return {
      role: "ai",
      content: (
        <>
          <p><strong>{unmatchedEntries.length} JE</strong> not yet matched with transactions bank:</p>
          <div className="ai-mini-table">
            {unmatchedEntries.slice(0, 5).map((e) => (
              <div className="ai-mini-row" key={e.je_number}>
                <div className="ai-mini-av">{e.je_number.slice(-3)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{e.je_number}</div>
                  <div className="ai-mini-meta">{e.memo}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Auto-match with AI</ChatChip>
            <ChatChip>Open manual reconciliation</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeBalanceResponse() {
    const variance = totalDebit - totalCredit;
    const balanced = Math.abs(variance) < 1;
    return {
      role: "ai",
      content: (
        <>
          <p>Summary GL {period}:</p>
          <ul style={{ paddingLeft: 16, margin: "8px 0", fontSize: 12 }}>
            <li>Total debit: <strong>{fmtRpShort(totalDebit)}</strong></li>
            <li>Total credit: <strong>{fmtRpShort(totalCredit)}</strong></li>
            <li>Status: {balanced ? <strong style={{ color: "var(--color-success-text)" }}>balanced ✓</strong> : <strong style={{ color: "var(--color-danger-text)" }}>variance {fmtRpShort(Math.abs(variance))}</strong>}</li>
            <li>Posted: <strong>{postedCount}</strong> · Pending: <strong>{pendingCount}</strong> · Draft: <strong>{draftCount}</strong></li>
          </ul>
        </>
      ),
    };
  }

  function makeDefaultResponse(text) {
    return {
      role: "ai",
      content: (
        <>
          <p>I can't answer "{text}" in this prototype, but can help with:</p>
          <div className="chat-chips">
            <ChatChip>Closing status</ChatChip>
            <ChatChip>Anomaly</ChatChip>
            <ChatChip>JE pending</ChatChip>
            <ChatChip>Unmatched to bank</ChatChip>
            <ChatChip>Total debit & credit</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text) {
    const t = text.toLowerCase();
    if (t.includes("closing") || t.includes("selesaikan") || t.includes("kunci")) return makeClosingResponse();
    if (t.includes("anomaly")) return makeAnomalyResponse();
    if (t.includes("pending") || t.includes("approval")) return makePendingResponse();
    if (t.includes("matched") || t.includes("recon") || t.includes("bank")) return makeUnmatchedResponse();
    if (t.includes("debit") || t.includes("credit") || t.includes("balanced") || t.includes("balance")) return makeBalanceResponse();
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
