import { ChatChip } from "./AiChatDrawer";

function fmtRpShort(n) {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
  return "Rp " + n.toLocaleString("id-ID");
}

// ── Insights ──────────────────────────────────────────────────────────────

export function computeTbInsights({ balance, anomalyes, netIncome, totalRev, totalExp, margin, period }) {
  const insights = [];
  const critical = anomalyes.filter((a) => a.severity === "critical");
  const warn     = anomalyes.filter((a) => a.severity === "warn");
  const info     = anomalyes.filter((a) => a.severity === "info");

  // 1. Balance status
  if (balance.balanced) {
    insights.push({
      id: "balanced",
      node: (
        <>
          Trial Balance <strong className="lg-ai-strong">balanced</strong> per{" "}
          <strong className="lg-ai-strong">{period}</strong> — total debit ={" "}
          credit <strong className="lg-ai-strong">{fmtRpShort(balance.dr)}</strong>.
        </>
      ),
      question: "What total debit & credit this period?",
    });
  } else {
    insights.push({
      id: "unbalanced",
      node: (
        <>
          Trial Balance <span className="lg-ai-danger">unbalanced</span> —{" "}
          variance <span className="lg-ai-danger">{fmtRpShort(balance.variance)}</span>.
        </>
      ),
      question: "Why is the Trial Balance unbalanced?",
    });
  }

  // 2. Net income
  insights.push({
    id: "netIncome",
    node: (
      <>
        Esteamated laba bersih{" "}
        {netIncome >= 0 ? (
          <strong className="lg-ai-strong" style={{ color: "var(--color-success-text)" }}>{fmtRpShort(netIncome)}</strong>
        ) : (
          <span className="lg-ai-danger">{fmtRpShort(netIncome)}</span>
        )}
        {totalRev > 0 && (
          <>
            {" "}— margin <strong className="lg-ai-strong">{margin}%</strong>.
          </>
        )}
      </>
    ),
    question: "Detail pendapatan & beban",
  });

  // 3. Critical anomalyes
  if (critical.length > 0) {
    insights.push({
      id: "critical",
      node: (
        <>
          <strong className="lg-ai-strong">{critical.length} finding kritis</strong> —{" "}
          <span className="lg-ai-danger">{critical[0].name}</span>
          {critical.length > 1 && ` + ${critical.length - 1} lainnya`}.
        </>
      ),
      question: "Detail finding kritis",
    });
  }

  // 4. Warnings
  if (warn.length > 0) {
    insights.push({
      id: "warn",
      node: (
        <>
          <strong className="lg-ai-strong">{warn.length} peringatan</strong> — needs review:{" "}
          {warn[0].name}{warn.length > 1 && ` + ${warn.length - 1} lainnya`}.
        </>
      ),
      question: "What peringatan this period?",
    });
  }

  // 5. Info-level insights
  if (info.length > 0) {
    insights.push({
      id: "info",
      node: (
        <>
          <strong className="lg-ai-strong">{info.length} info</strong> tambahan from Klay AI about account related.
        </>
      ),
      question: "Show info & rekomendasi AI",
    });
  }

  // No anomalyes — happy path
  if (anomalyes.length === 0) {
    insights.push({
      id: "clean",
      node: (
        <>
          <strong className="lg-ai-strong">None anomaly</strong> — semua account within normal range.
        </>
      ),
      question: "Why is this period clean?",
    });
  }

  return insights;
}

// ── AI chat context ──────────────────────────────────────────────────────

export function makeTbAiContext({ balance, anomalyes, netIncome, totalRev, totalExp, margin, period, accountCount, topAssets = [], topLiabilities = [] }) {
  const critical = anomalyes.filter((a) => a.severity === "critical");
  const warn     = anomalyes.filter((a) => a.severity === "warn");

  const welcome = (
    <p>Hi Sside — I have reviewed Trial Balance as of {period}. How can I help?</p>
  );

  const suggestions = [
    "What finding most penting this period?",
    "Detail pendapatan & beban",
    "What total debit & credit this period?",
    "Account which with the largest?",
  ];

  function anomalyList(list, max = 5) {
    return (
      <div className="ai-mini-table">
        {list.slice(0, max).map((a, i) => (
          <div className="ai-mini-row" key={a.code + i}>
            <div className="ai-mini-av" style={{ background: a.severity === "critical" ? "var(--color-danger-text)" : a.severity === "warn" ? "var(--color-warning-text)" : "var(--color-action)" }}>
              {a.severity === "critical" ? "!" : a.severity === "warn" ? "△" : "i"}
            </div>
            <div className="ai-mini-body">
              <div className="ai-mini-name">{a.code} · {a.name}</div>
              <div className="ai-mini-meta">{a.title}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function makeBalanceResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>Summary Trial Balance as of {period}:</p>
          <ul style={{ paddingLeft: 16, margin: "8px 0", fontSize: 12 }}>
            <li>Total account: <strong>{accountCount}</strong></li>
            <li>Total debit: <strong>{fmtRpShort(balance.dr)}</strong></li>
            <li>Total credit: <strong>{fmtRpShort(balance.cr)}</strong></li>
            <li>Status: {balance.balanced ? <strong style={{ color: "var(--color-success-text)" }}>balanced ✓</strong> : <strong style={{ color: "var(--color-danger-text)" }}>variance {fmtRpShort(balance.variance)}</strong>}</li>
          </ul>
        </>
      ),
    };
  }

  function makeIncomeResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>Esteamated laporan laba-rugi this period:</p>
          <ul style={{ paddingLeft: 16, margin: "8px 0", fontSize: 12 }}>
            <li>Total Revenue: <strong>{fmtRpShort(totalRev)}</strong></li>
            <li>Total Expenses: <strong>{fmtRpShort(totalExp)}</strong></li>
            <li>Net Income: {netIncome >= 0
              ? <strong style={{ color: "var(--color-success-text)" }}>{fmtRpShort(netIncome)}</strong>
              : <strong style={{ color: "var(--color-danger-text)" }}>{fmtRpShort(netIncome)}</strong>}
            </li>
            <li>Margin: <strong>{margin}%</strong></li>
          </ul>
          <div className="chat-chips">
            <ChatChip primary>Breakdown pendapatan as of produk</ChatChip>
            <ChatChip>Breakdown beban as of category</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeCriticalResponse() {
    if (critical.length === 0) return { role: "ai", content: <p>None finding kritis this period.</p> };
    return {
      role: "ai",
      content: (
        <>
          <p><strong>{critical.length} finding kritis</strong> ditemukan:</p>
          {anomalyList(critical)}
          <div className="chat-chips">
            <ChatChip primary>Review satu as of satu</ChatChip>
            <ChatChip>Mark all as valid</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeWarnResponse() {
    if (warn.length === 0) return { role: "ai", content: <p>None peringatan this period.</p> };
    return {
      role: "ai",
      content: (
        <>
          <p><strong>{warn.length} peringatan</strong>:</p>
          {anomalyList(warn)}
        </>
      ),
    };
  }

  function makeTopAccountsResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>Account with balance largest this period:</p>
          {topAssets.length > 0 && (
            <>
              <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "8px 0 4px" }}>Assets</p>
              <div className="ai-mini-table">
                {topAssets.slice(0, 3).map((a) => (
                  <div className="ai-mini-row" key={a.code}>
                    <div className="ai-mini-av">{a.code.slice(0, 3)}</div>
                    <div className="ai-mini-body">
                      <div className="ai-mini-name">{a.code} · {a.name}</div>
                    </div>
                    <div className="ai-mini-amt">{fmtRpShort(a.closing_balance)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {topLiabilities.length > 0 && (
            <>
              <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "8px 0 4px" }}>Liabilities</p>
              <div className="ai-mini-table">
                {topLiabilities.slice(0, 3).map((a) => (
                  <div className="ai-mini-row" key={a.code}>
                    <div className="ai-mini-av">{a.code.slice(0, 3)}</div>
                    <div className="ai-mini-body">
                      <div className="ai-mini-name">{a.code} · {a.name}</div>
                    </div>
                    <div className="ai-mini-amt">{fmtRpShort(a.closing_balance)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
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
            <ChatChip>Finding kritis</ChatChip>
            <ChatChip>Warning</ChatChip>
            <ChatChip>Laba & beban</ChatChip>
            <ChatChip>Account largest</ChatChip>
            <ChatChip>Status balanced</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text) {
    const t = text.toLowerCase();
    if (t.includes("kritis") || t.includes("critical") || t.includes("finding")) return makeCriticalResponse();
    if (t.includes("peringatan") || t.includes("warn")) return makeWarnResponse();
    if (t.includes("pendapatan") || t.includes("beban") || t.includes("laba") || t.includes("rugi") || t.includes("income")) return makeIncomeResponse();
    if (t.includes("debit") || t.includes("credit") || t.includes("balanced") || t.includes("balance") || t.includes("total")) return makeBalanceResponse();
    if (t.includes("largest") || t.includes("most besar") || t.includes("top")) return makeTopAccountsResponse();
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
