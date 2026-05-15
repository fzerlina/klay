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
  const tokens = name.split(/\s+/).filter((t) => t && !/^(PT|CV|UD|Toko|Koperasi)$/i.test(t));
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
    <p>Halo Sarah — saya sudah membaca data piutang Anda hari ini. Mau saya bantu apa?</p>
  );

  const suggestions = [
    "Customer mana yang paling sering telat?",
    "Bagaimana proyeksi cashflow 7 hari ke depan?",
    `Buatkan template reminder untuk ${reminderTarget}`,
    "Bandingkan piutang bulan ini vs bulan lalu",
  ];

  function makeTopCustomersResponse(send) {
    const totalShare = top.reduce((s, c) => s + c.amount, 0);
    const pct = totalOverdue ? Math.round((totalShare / totalOverdue) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 customer ini paling sering telat di 90 hari terakhir:</p>
          <div className="ai-mini-table">
            {top.map((c) => {
              const cust = CUSTOMERS.find((x) => x.id === c.id);
              return (
                <div className="ai-mini-row" key={c.id}>
                  <div className="ai-mini-av">{initials(cust?.name || c.name)}</div>
                  <div className="ai-mini-body">
                    <div className="ai-mini-name">{cust?.name || c.name}</div>
                    <div className="ai-mini-meta">
                      rata-rata <span className="ai-mini-meta-strong">{c.avgDpd}d</span> telat · {c.count} invoice aktif
                    </div>
                  </div>
                  <div className="ai-mini-amt">{fmtRpShort(c.amount)}</div>
                </div>
              );
            })}
          </div>
          <p>
            Bersama-sama mereka menyumbang <strong>{pct}%</strong> piutang telat. Mau saya buatkan draft reminder untuk ketiganya?
          </p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, buat draft reminder")}>Ya, buat draft reminder</ChatChip>
            <ChatChip onClick={() => send("Tampilkan riwayat penagihan")}>Tampilkan riwayat</ChatChip>
            <ChatChip onClick={() => send("Saya akan telpon manual saja")}>Telpon manual saja</ChatChip>
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
            Proyeksi cashflow 7 hari ke depan: <strong>Rp 4,2 M</strong> diharapkan masuk dari 18 invoice yang jatuh tempo.{" "}
            <span className="danger">3 invoice berisiko telat</span> jika tidak ada follow-up.
          </p>
          <p>Mau saya buatkan reminder untuk 3 invoice yang berisiko?</p>
          <div className="chat-chips">
            <ChatChip primary>Buat reminder otomatis</ChatChip>
            <ChatChip>Lihat detailnya dulu</ChatChip>
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
          <p>Draft reminder untuk <strong>{name}</strong>:</p>
          <div className="ai-mini-table" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--color-text-secondary)", whiteSpace: "pre-line" }}>
              {`Yth. Tim Keuangan ${name},\n\nKami ingin mengingatkan bahwa invoice yang kami terbitkan telah melewati tanggal jatuh tempo. Mohon dapat segera ditindaklanjuti agar tidak mengganggu kerja sama kita.\n\nDetail tagihan terlampir. Terima kasih atas perhatiannya.`}
            </div>
          </div>
          <div className="chat-chips">
            <ChatChip primary>Kirim ke customer</ChatChip>
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
            Piutang bulan ini <strong>Rp 11,7 M</strong> — naik{" "}
            <span style={{ color: "var(--color-warning-text)", fontWeight: 600 }}>+18%</span> dari bulan lalu (Rp 9,9 M). Sebagian besar peningkatan dari segmen <strong>Distribusi</strong> (4 customer baru).
          </p>
          <p>Mau saya bandingkan per segmen atau per customer?</p>
          <div className="chat-chips">
            <ChatChip primary>Per segmen</ChatChip>
            <ChatChip>Per customer</ChatChip>
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
          <p>Saya belum bisa menjawab "{text}" secara spesifik di prototipe ini, tapi saya bisa bantu hal-hal berikut:</p>
          <div className="chat-chips">
            <ChatChip>Customer paling sering telat</ChatChip>
            <ChatChip>Proyeksi cashflow</ChatChip>
            <ChatChip>Bandingkan dengan bulan lalu</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("telat") || t.includes("sering") || t.includes("customer mana")) {
      return makeTopCustomersResponse(helpers.send);
    }
    if (t.includes("cashflow") || t.includes("proyeksi") || t.includes("7 hari")) {
      return makeCashflowResponse();
    }
    if (t.includes("reminder") || t.includes("template")) {
      return makeReminderTemplateResponse(reminderTarget);
    }
    if (t.includes("bulan lalu") || t.includes("bandingkan") || t.includes("mom")) {
      return makeMoMResponse();
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
