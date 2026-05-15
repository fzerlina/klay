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
  const tokens = name.split(/\s+/).filter((t) => t && !/^(PT|CV|UD|Toko|Koperasi)$/i.test(t));
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
          ))}) menyumbang{" "}
          <strong className="lg-ai-strong">{top3Pct}%</strong> dari{" "}
          <span className="lg-ai-danger">{fmtRpShort(totalAr)}</span> piutang aktif.
        </>
      ),
      question: "Customer mana yang paling besar piutangnya?",
    });
  }

  if (overdue.length > 0) {
    insights.push({
      id: "overdueCusts",
      node: (
        <>
          <strong className="lg-ai-strong">{overdue.length} customer</strong> punya invoice yang sudah jatuh tempo,{" "}
          total <span className="lg-ai-danger">{fmtRpShort(overdueAr)}</span> belum tertagih.
        </>
      ),
      question: "Customer mana saja yang invoice-nya overdue?",
    });
  }

  if (creditExceeded.length > 0) {
    insights.push({
      id: "creditExceeded",
      node: (
        <>
          <strong className="lg-ai-strong">{creditExceeded.length} customer</strong> sudah melewati credit limit — perlu diperhatikan sebelum buat invoice baru.
        </>
      ),
      question: "Customer mana yang melewati credit limit?",
    });
  }

  if (stale.length > 0) {
    insights.push({
      id: "stale",
      node: (
        <>
          <strong className="lg-ai-strong">{stale.length} customer</strong> aktif tidak ada invoice baru lebih dari{" "}
          <strong className="lg-ai-strong">60 hari</strong> — peluang follow-up sales.
        </>
      ),
      question: "Customer mana yang sudah lama tidak transaksi?",
    });
  }

  if (inactiveWithAr.length > 0) {
    const sum = inactiveWithAr.reduce((s, c) => s + (c.ar || 0), 0);
    insights.push({
      id: "inactiveAr",
      node: (
        <>
          <strong className="lg-ai-strong">{inactiveWithAr.length} customer non-aktif</strong> masih memiliki saldo piutang{" "}
          <span className="lg-ai-danger">{fmtRpShort(sum)}</span> — perlu di-review.
        </>
      ),
      question: "Customer non-aktif mana yang masih punya saldo?",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      node: <>Tidak ada saldo piutang yang aktif — master customer bersih.</>,
      question: "Ringkasan customer secara umum",
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
    <p>Halo Sarah — saya sudah membaca master customer Anda. Mau saya bantu apa?</p>
  );

  const suggestions = [
    "Customer mana yang paling besar piutangnya?",
    "Customer mana saja yang invoice-nya overdue?",
    "Customer mana yang melewati credit limit?",
    "Customer mana yang sudah lama tidak transaksi?",
  ];

  function makeTopArCustomersResponse(send) {
    const sum = top.reduce((s, c) => s + c.amount, 0);
    const pct = totalAr ? Math.round((sum / totalAr) * 100) : 0;
    return {
      role: "ai",
      content: (
        <>
          <p>3 customer dengan piutang aktif terbesar:</p>
          <div className="ai-mini-table">
            {top.map((c) => (
              <div className="ai-mini-row" key={c.id}>
                <div className="ai-mini-av">{initials(c.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{c.name}</div>
                  <div className="ai-mini-meta">
                    {c.type === "perusahaan" ? "Perusahaan" : "Individu"} · term {c.top}
                    {c.arOverdue && <span style={{ color: "var(--color-danger-text)", fontWeight: 600 }}> · ada invoice telat</span>}
                  </div>
                </div>
                <div className="ai-mini-amt">{fmtRpShort(c.amount)}</div>
              </div>
            ))}
          </div>
          <p>Bersama mereka <strong>{pct}%</strong> dari total piutang aktif. Mau saya buatkan reminder?</p>
          <div className="chat-chips">
            <ChatChip primary onClick={() => send("Ya, buat draft reminder untuk top 3")}>Buat reminder</ChatChip>
            <ChatChip onClick={() => send("Lihat detail invoice per customer")}>Lihat detail invoice</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeOverdueResponse() {
    if (overdue.length === 0) {
      return { role: "ai", content: <p>Tidak ada customer dengan invoice overdue saat ini.</p> };
    }
    const sample = overdue.slice(0, 5);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{overdue.length} customer</strong> punya invoice overdue. Sample:
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
            <ChatChip primary>Kirim reminder massal</ChatChip>
            <ChatChip>Lihat semuanya</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeCreditLimitResponse() {
    if (creditExceeded.length === 0) {
      return { role: "ai", content: <p>Belum ada customer yang melewati credit limit.</p> };
    }
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{creditExceeded.length} customer</strong> sudah melewati credit limit:
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
            <ChatChip primary>Naikkan limit</ChatChip>
            <ChatChip>Pause invoice baru</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeStaleResponse() {
    if (stale.length === 0) {
      return { role: "ai", content: <p>Semua customer aktif transaksinya baru.</p> };
    }
    const sample = stale.slice(0, 5);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{stale.length} customer</strong> aktif tidak ada invoice baru lebih dari 60 hari — kandidat reach-out sales:
          </p>
          <div className="ai-mini-table">
            {sample.map((c) => (
              <div className="ai-mini-row" key={c.id}>
                <div className="ai-mini-av">{initials(c.name)}</div>
                <div className="ai-mini-body">
                  <div className="ai-mini-name">{c.name}</div>
                  <div className="ai-mini-meta">invoice terakhir {c.lastInv} · {daysSince(c.lastInv)} hari lalu</div>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-chips">
            <ChatChip primary>Daftar lengkap</ChatChip>
            <ChatChip>Buat campaign reach-out</ChatChip>
          </div>
        </>
      ),
    };
  }

  function makeInactiveResponse() {
    if (inactiveWithAr.length === 0) {
      return { role: "ai", content: <p>Tidak ada customer non-aktif dengan saldo piutang.</p> };
    }
    const sum = inactiveWithAr.reduce((s, c) => s + (c.ar || 0), 0);
    return {
      role: "ai",
      content: (
        <>
          <p>
            <strong>{inactiveWithAr.length} customer non-aktif</strong> masih punya piutang total{" "}
            <span className="danger">{fmtRpShort(sum)}</span>.
          </p>
          <div className="chat-chips">
            <ChatChip primary>Aktifkan kembali</ChatChip>
            <ChatChip>Tandai bad debt</ChatChip>
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
          <p>Saya belum bisa menjawab "{text}" di prototipe ini, tapi saya bisa bantu hal-hal berikut:</p>
          <div className="chat-chips">
            <ChatChip>Top customer piutang</ChatChip>
            <ChatChip>Customer overdue</ChatChip>
            <ChatChip>Credit limit exceeded</ChatChip>
          </div>
        </>
      ),
    };
  }

  function respond(text, helpers) {
    const t = text.toLowerCase();
    if (t.includes("paling besar") || t.includes("paling banyak") || t.includes("top customer") || t.includes("piutangnya")) {
      return makeTopArCustomersResponse(helpers.send);
    }
    if (t.includes("overdue") || t.includes("jatuh tempo") || t.includes("invoice-nya")) {
      return makeOverdueResponse();
    }
    if (t.includes("credit limit") || t.includes("limit")) {
      return makeCreditLimitResponse();
    }
    if (t.includes("lama tidak") || t.includes("dorman") || t.includes("stale")) {
      return makeStaleResponse();
    }
    if (t.includes("non-aktif") || t.includes("inaktif")) {
      return makeInactiveResponse();
    }
    return makeDefaultResponse(text);
  }

  return { welcome, suggestions, respond };
}
