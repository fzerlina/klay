import { CUSTOMERS } from "../data/seed/customers";
import { daysSince } from "../lib/clock";
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

function computeTopCustomers(invoices) {
  const overdue = invoices.filter((i) => i.payStatus === "overdue");
  const byCustomer = new Map();
  for (const inv of overdue) {
    const prev = byCustomer.get(inv.customer) || { id: inv.customer, name: inv.customerName, amount: 0, count: 0, dpdSum: 0 };
    prev.amount += inv.total;
    prev.count += 1;
    prev.dpdSum += Math.max(0, daysSince(inv.due));
    byCustomer.set(inv.customer, prev);
  }
  const arr = Array.from(byCustomer.values()).map((c) => ({ ...c, avgDpd: Math.round(c.dpdSum / c.count) }));
  arr.sort((a, b) => b.amount - a.amount);
  return { top: arr.slice(0, 3), totalOverdue: overdue.reduce((s, i) => s + i.total, 0) };
}

// Returns a context object compatible with AiChatDrawer:
//   { welcome, suggestions, respond }
export function makeInvoicesAiContext(invoices) {
  const { top, totalOverdue } = computeTopCustomers(invoices);
  const reminderTarget = top[0] ? shortName(top[0].name) : "customer top";

  const welcome = (
    <p>Hi Sarah — I have reviewed your data today. How can I help?</p>
  );

  const suggestions = [
    "Which customers pay late most often?",
    "How proyeksi cashflow 7 days to depan?",
    `Buatkan template reminder for ${reminderTarget}`,
    "Compare receivables this month vs last month",
  ];

  function makeTopCustomersResponse(send) {
    const totalShare = top.reduce((s, c) => s + c.amount, 0);
    const pct = totalOverdue ? Math.round((totalShare / totalOverdue) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 customer ini most often late di 90 days last:</p>
          <div className="ai-mini-table">
            {top.map((c) => {
              const cust = CUSTOMERS.find((x) => x.id === c.id);
              return (
                <div className="ai-mini-row" key={c.id}>
                  <div className="ai-mini-av">{initials(cust?.name || c.name)}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{cust?.name || c.name}</div>
                    <div className="ai-mini-meta">
                      average <span className="ai-mini-meta-strong">{c.avgDpd}d</span> late · {c.count} invoice active
                    </div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(c.amount)}</div>
                </div>
              );
            })}
          </div>
          <p>
            Together they account for <strong>{pct}%</strong> receivables late. Want me to create draft reminder for all three?
          </p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, buat draft reminder")}>Ya, buat draft reminder</ChatChip>
            <ChatChip onClick={() => send("Show riwayat penagihan")}>Show riwayat</ChatChip>
            <ChatChip onClick={() => send("I will call manually")}>Telpon manual saja</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeCashflowResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>
            Proyeksi cashflow 7 days to depan: <strong>Rp 4,2 M</strong> diharapkan masuk from 18 invoice that due.{" "}
            <span className="danger">3 invoice berisiko late</span> jika none follow-up.
          </p>
          <p>Want me to create a reminder for 3 invoice that berisiko?</p>
          <div className="chat-chips">
            <ChatChip primary>Create reminder automatic</ChatChip>
            <ChatChip>View detailnya dulu</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeReminderTemplateResponse(name) {
    return {
      role: "ai",
      content: (
        <>
          <p>Draft reminder for <strong>{name}</strong>:</p>
          <div className="ai-mini-table" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--color-text-secondary)", whiteSpace: "pre-line" }}>
              {`Yth. Tim Keuangan ${name},\n\nKami ingin mengingatkan bahwa invoice that kami terbitkan telah passes date due. Mohon dapat segera ditindaklanjuti to avoid mengganggu kerja same we.\n\nDetail tagihan terlampir. Terima cashih for attentionnya.`}
            </div>
          </div>
          <div className="chat-chips">
            <ChatChip primary>Send to customer</ChatChip>
            <ChatChip>Edit dulu</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeMoMResponse() {
    return {
      role: "ai",
      content: (
        <>
          <p>
            Pipayables this month <strong>Rp 11,7 M</strong> — up{" "}
            <span style={{ color: "var(--color-warning-text)", fontWeight: 600 }}>+18%</span> from last month (Rp 9,9 M). Sebagian besar increase from segmen <strong>Distribusi</strong> (4 customer baru).
          </p>
          <p>Want me to bandingkan as of segmen atau as of customer?</p>
          <div className="chat-chips">
            <ChatChip primary>As of segmen</ChatChip>
            <ChatChip>As of customer</ChatChip>
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
          <p>I can't specifically answer "{text}" in this prototype, but I can help with:</p>
          <div className="chat-chips">
            <ChatChip>Customer most often late</ChatChip>
            <ChatChip>Proyeksi cashflow</ChatChip>
            <ChatChip>Compare with last month</ChatChip>
          </div>
        </>
      ),
    };
  }

  // ── Filter-intent detection + preview ──────────────────────────────────
  const FILTER_LEAD_RE = /^(show me|show|list|find|which|open|filter|all the|give me)\b/i;
  const FILTER_KEYWORD_RE = /\b(overdue|drafts?|sent|paid|lunas|auto|whats?app|email|this\s+(week|month)|last\s+(week|month)|0-30|30-60|60-90|90\+|days)\b/i;
  const AMOUNT_RE = /(\d+(?:[.,]\d+)?)\s*[mb]\b/i;
  function looksLikeFilterRequest(t) {
    return FILTER_LEAD_RE.test(t) || FILTER_KEYWORD_RE.test(t) || AMOUNT_RE.test(t);
  }

  function pickMatching(t) {
    const lower = t.toLowerCase();
    let list = invoices;
    if (/\bauto\b/.test(lower)) list = list.filter(i => i.approval === "auto");
    else if (/\bdrafts?\b/.test(lower)) list = list.filter(i => i.approval === "draft");
    else if (/\bsent\b/.test(lower)) list = list.filter(i => i.approval === "sent");
    if (/\boverdue\b/.test(lower) || /\blate\b/.test(lower)) list = list.filter(i => i.payStatus === "overdue");
    if (/\bpaid\b|\blunas\b/.test(lower)) list = list.filter(i => i.payStatus === "lunas");
    if (/\bwhats?app\b/.test(lower)) list = list.filter(i => i.ai_source === "whatsapp");
    if (/\b(from\s+)?email\b/.test(lower) && !/\bwhats?app\b/.test(lower)) list = list.filter(i => i.ai_source === "email");
    const amt = lower.match(/(\d+(?:[.,]\d+)?)\s*([mb])\b/);
    if (amt) {
      const n = parseFloat(amt[1].replace(",", ".")) * (amt[2] === "b" ? 1e9 : 1e6);
      list = list.filter(i => i.total >= n);
    }
    if (/\b90\+\b|over\s*90/.test(lower)) list = list.filter(i => i.payStatus === "overdue" && daysSince(i.due) >= 90);
    else if (/\b60[-\s]*90\b/.test(lower)) list = list.filter(i => i.payStatus === "overdue" && daysSince(i.due) >= 60 && daysSince(i.due) < 90);
    else if (/\b30[-\s]*60\b/.test(lower)) list = list.filter(i => i.payStatus === "overdue" && daysSince(i.due) >= 30 && daysSince(i.due) < 60);
    else if (/\b0[-\s]*30\b/.test(lower)) list = list.filter(i => i.payStatus === "overdue" && daysSince(i.due) >= 0 && daysSince(i.due) < 30);
    return list;
  }

  function makeFilterResponse(originalText) {
    const matches = pickMatching(originalText);
    if (matches.length === 0) {
      return {
        role: "ai",
        content: (
          <>
            <p>None invoice matching <em>"{originalText}"</em> di data ini.</p>
            <p>Coba lebih spesifik — misalnya "overdue from email" atau "auto whatsapp".</p>
          </>
        ),
      };
    }
    const top = matches.slice(0, 3);
    return {
      role: "ai",
      content: (
        <>
          <p>
            Found <strong>{matches.length}</strong> {matches.length === 1 ? "invoice" : "invoices"} matching.{" "}
            {matches.length > 3 && "Top three:"}
          </p>
          <div className="ai-mini-table">
            {top.map((inv) => {
              const cust = CUSTOMERS.find((x) => x.id === inv.customer);
              const dpd = inv.payStatus === "overdue" ? Math.max(0, daysSince(inv.due)) : 0;
              return (
                <div className="ai-mini-row" key={inv.id}>
                  <div className="ai-mini-av">{initials(cust?.name || inv.customerName)}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{inv.invNo === "—" ? "(Draft)" : inv.invNo}</div>
                    <div className="ai-mini-meta">
                      {shortName(inv.customerName)}
                      {dpd > 0 && <> · <span className="ai-mini-meta-strong">{dpd}d</span> late</>}
                      {inv.approval === "auto" && inv.ai_source && <> · {inv.ai_source}</>}
                    </div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(inv.total)}</div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="chat-chip primary klay-open-in-table"
            onClick={() => window.dispatchEvent(new CustomEvent("klay:apply-filters", { detail: { query: originalText, count: matches.length } }))}
          >
            ✦ Open {matches.length} {matches.length === 1 ? "result" : "results"} in table →
          </button>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("late") || t.includes("sering") || t.includes("customer which")) {
      return makeTopCustomersResponse(helpers.send);
    }
    if (t.includes("cashflow") || t.includes("proyeksi") || t.includes("7 days")) {
      return makeCashflowResponse();
    }
    if (t.includes("reminder") || t.includes("template")) {
      return makeReminderTemplateResponse(reminderTarget);
    }
    if (t.includes("last month") || t.includes("bandingkan") || t.includes("mom")) {
      return makeMoMResponse();
    }
    if (looksLikeFilterRequest(text)) {
      return makeFilterResponse(text);
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
