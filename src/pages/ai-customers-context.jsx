import { TODAY, daysSince } from "../lib/clock";
import { initials } from "../lib/format";
import { ChatChip } from "./AiChatDrawer";

function fmtRpShort(n) {
  if (n == null) return "—";
  if (n >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " jt";
  return "Rp " + n.toLocaleString("id-ID");
}

function shortName(name) {
  if (!name) return "—";
  const tokens = name.split(/\s+/).filter((t) => t && !/^(PT|CV|UD|Toko|Cooperative)$/i.test(t));
  return tokens.slice(0, 2).join(" ");
}

// ── Insights ──────────────────────────────────────────────────────────────

export function computeCustomersInsights(customers) {
  const totalAr = customers.reduce((s, c) => s + (c.ar || 0), 0);
  const arCusts = customers.filter((c) => (c.ar || 0) > 0);
  const overdue = customers.filter((c) => c.arOverdue && c.active);
  const overdueAr = overdue.reduce((s, c) => s + (c.ar || 0), 0);
  const stale = customers.filter((c) => c.active && daysSince(c.lastInv) >= 60);
  const inactiveWithAr = customers.filter((c) => !c.active && (c.ar || 0) > 0);
  const creditExceeded = customers.filter((c) => (c.creditLimit || 0) > 0 && (c.ar || 0) > c.creditLimit);

  const top3 = arCusts
    .map((c) => ({ id: c.id, name: c.name, amount: c.ar, type: c.type, arOverdue: c.arOverdue, lastInv: c.lastInv }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const top3Sum = top3.reduce((s, c) => s + c.amount, 0);
  const top3Pct = totalAr ? Math.round((top3Sum / totalAr) * 100) : 0;

  const insights = [];

  if (top3.length > 0 && totalAr > 0) {
    insights.push({
      id: "topArCustomers",
      node: (
        <>
          <strong className="lg-ai-strong">{top3.length} customer</strong>{" "}
          ({top3.map((c, i) => (
            <span key={c.id}>{i > 0 ? ", " : ""}{shortName(c.name)}</span>
          ))}) account for{" "}
          <strong className="lg-ai-strong">{top3Pct}%</strong> of{" "}
          <span className="lg-ai-danger">{fmtRpShort(totalAr)}</span> receivables active.
        </>
      ),
      question: "Which customers have the largest receivables?",
    });
  }

  if (overdue.length > 0) {
    insights.push({
      id: "overdueCusts",
      node: (
        <>
          <strong className="lg-ai-strong">{overdue.length} customer</strong> have invoices that are overdue,{" "}
          total <span className="lg-ai-danger">{fmtRpShort(overdueAr)}</span> uncollected.
        </>
      ),
      question: "Which customers have overdue invoices?",
    });
  }

  if (creditExceeded.length > 0) {
    insights.push({
      id: "creditExceeded",
      node: (
        <>
          <strong className="lg-ai-strong">{creditExceeded.length} customer</strong> have exceeded credit limit — review before issuing new invoices.
        </>
      ),
      question: "Which customer that passes credit limit?",
    });
  }

  if (stale.length > 0) {
    insights.push({
      id: "stale",
      node: (
        <>
          <strong className="lg-ai-strong">{stale.length} customer</strong> active with no new invoices over{" "}
          <strong className="lg-ai-strong">60 days</strong> — peluang follow-up sales.
        </>
      ),
      question: "Which customer that long since had transactions?",
    });
  }

  if (inactiveWithAr.length > 0) {
    const sum = inactiveWithAr.reduce((s, c) => s + (c.ar || 0), 0);
    insights.push({
      id: "inactiveAr",
      node: (
        <>
          <strong className="lg-ai-strong">{inactiveWithAr.length} customer inactive</strong> still have balance receivables{" "}
          <span className="lg-ai-danger">{fmtRpShort(sum)}</span> — needs review.
        </>
      ),
      question: "Customer inactive which that masih have a balance?",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>None balance receivables that active — master customer clean.</>,
      question: "Summary customer in general",
    });
  }

  return insights;
}

// ── AI chat context ──────────────────────────────────────────────────────

export function makeCustomersAiContext(customers) {
  const totalAr = customers.reduce((s, c) => s + (c.ar || 0), 0);
  const arCusts = customers.filter((c) => (c.ar || 0) > 0);
  const overdue = customers.filter((c) => c.arOverdue && c.active);
  const stale = customers.filter((c) => c.active && daysSince(c.lastInv) >= 60);
  const inactiveWithAr = customers.filter((c) => !c.active && (c.ar || 0) > 0);
  const creditExceeded = customers.filter((c) => (c.creditLimit || 0) > 0 && (c.ar || 0) > c.creditLimit);

  const top = arCusts
    .map((c) => ({ id: c.id, name: c.name, amount: c.ar, type: c.type, arOverdue: c.arOverdue, lastInv: c.lastInv, top: c.top, creditLimit: c.creditLimit || 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const welcome = (
    <p>Hi Sarah — I have reviewed your customer master. How can I help?</p>
  );

  const suggestions = [
    "Which customers have the largest receivables?",
    "Which customers have overdue invoices?",
    "Which customer that passes credit limit?",
    "Which customer that long since had transactions?",
  ];

  function makeTopArCustomersResponse(send) {
    const sum = top.reduce((s, c) => s + c.amount, 0);
    const pct = totalAr ? Math.round((sum / totalAr) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 customer with receivables active largest:</p>
          <div className="ai-mini-table">
            {top.map((c) => (
              <div className="ai-mini-row" key={c.id}>
                <div className="ai-mini-av">{initials(c.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{c.name}</div>
                  <div className="ai-mini-meta">
                    {c.type === "perusahaan" ? "Company" : "Individual"} · term {c.top}
                    {c.arOverdue && <span style={{ color: "var(--color-danger-text)", fontWeight: 600 }}> · with late invoices</span>}
                  </div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(c.amount)}</div>
              </div>
            ))}
          </div>
          <p>Together they <strong>{pct}%</strong> from total receivables active. Want me to create a reminder?</p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, buat draft reminder for top 3")}>Create reminder</ChatChip>
            <ChatChip onClick={() => send("View detail invoice as of customer")}>View detail invoice</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeOverdueResponse() {
    if (overdue.length === 0) {
      return { role: "ai", content: <p>None customer with invoice overdue saat ini.</p> };
    }
    const sample = overdue.slice(0, 5);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{overdue.length} customer</strong> have invoices overdue. Sample:
          </p>
          <div className="ai-mini-table">
            {sample.map((c) => (
              <div className="ai-mini-row" key={c.id}>
                <div className="ai-mini-av">{initials(c.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{c.name}</div>
                  <div className="ai-mini-meta">term {c.top} · last invoice {c.lastInv}</div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(c.ar)}</div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Send reminder massal</ChatChip>
            <ChatChip>View semuanya</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeCreditLimitResponse() {
    if (creditExceeded.length === 0) {
      return { role: "ai", content: <p>Not yet there is customer that passes credit limit.</p> };
    }
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{creditExceeded.length} customer</strong> already passes credit limit:
          </p>
          <div className="ai-mini-table">
            {creditExceeded.slice(0, 5).map((c) => (
              <div className="ai-mini-row" key={c.id}>
                <div className="ai-mini-av">{initials(c.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{c.name}</div>
                  <div className="ai-mini-meta">
                    AR {fmtRpShort(c.ar)} / limit {fmtRpShort(c.creditLimit)}
                  </div>
                </div>
                <div className="ai-mini-amt" style={{ color: "var(--color-danger-text)" }}>
                  +{fmtRpShort(c.ar - c.creditLimit)}
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Increase limit</ChatChip>
            <ChatChip>Pause new invoices</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeStaleResponse() {
    if (stale.length === 0) {
      return { role: "ai", content: <p>All customer active transactionsnya baru.</p> };
    }
    const sample = stale.slice(0, 5);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{stale.length} customer</strong> active no new invoices over 60 days — sales follow-up candidates:
          </p>
          <div className="ai-mini-table">
            {sample.map((c) => (
              <div className="ai-mini-row" key={c.id}>
                <div className="ai-mini-av">{initials(c.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{c.name}</div>
                  <div className="ai-mini-meta">invoice last {c.lastInv} · {daysSince(c.lastInv)} days ago</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Full list</ChatChip>
            <ChatChip>Create campaign reach-out</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeInactiveResponse() {
    if (inactiveWithAr.length === 0) {
      return { role: "ai", content: <p>None customer inactive with balance receivables.</p> };
    }
    const sum = inactiveWithAr.reduce((s, c) => s + (c.ar || 0), 0);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{inactiveWithAr.length} customer inactive</strong> still have receivables total{" "}
            <span className="danger">{fmtRpShort(sum)}</span>.
          </p>
          <div className="chat-chips">
            <ChatChip primary>Reactivate</ChatChip>
            <ChatChip>Mark bad debt</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeDefaultResponse(text) {
    return {
      role: "ai",
      content: (
        <>
          <p>I can't answer "{text}" in this prototype, but I can help with:</p>
          <div className="chat-chips">
            <ChatChip>Top customer receivables</ChatChip>
            <ChatChip>Customer overdue</ChatChip>
            <ChatChip>Credit limit exceeded</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("most besar") || t.includes("most") || t.includes("top customer") || t.includes("receivables")) {
      return makeTopArCustomersResponse(helpers.send);
    }
    if (t.includes("overdue") || t.includes("due") || t.includes("their invoice")) {
      return makeOverdueResponse();
    }
    if (t.includes("credit limit") || t.includes("limit")) {
      return makeCreditLimitResponse();
    }
    if (t.includes("long since") || t.includes("dorman") || t.includes("stale")) {
      return makeStaleResponse();
    }
    if (t.includes("inactive") || t.includes("inactive")) {
      return makeInactiveResponse();
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
