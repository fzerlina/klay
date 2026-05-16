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
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
