import { useState, useEffect, useRef, useMemo } from "react";
import { useInvoices } from "../state/InvoicesContext";
import { CUSTOMERS } from "../data/seed/customers";
import { daysSince } from "../lib/clock";
import { initials } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────

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

// ── Atoms ─────────────────────────────────────────────────────────────────

const SparkleIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
    <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
  </svg>
);

function AiBubble({ children }) {
  return (
    <div className="ai-bubble">
      <div className="ai-bubble-av"><SparkleIcon /></div>
      <div className="ai-bubble-body">{children}</div>
    </div>
  );
}

function UserBubble({ children }) {
  return (
    <div className="user-bubble-row">
      <div className="user-bubble">{children}</div>
    </div>
  );
}

function ChatChip({ children, primary, onClick }) {
  return (
    <button className={`chat-chip${primary ? " primary" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function TypingDots() {
  return (
    <span className="ai-typing">
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
    </span>
  );
}

// ── Stubbed conversation responder ────────────────────────────────────────

function makeTopCustomersResponse(top, totalOverdue, onChip) {
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
          Bersama-sama mereka menyumbang{" "}
          <strong>{pct}%</strong> piutang telat. Mau saya buatkan draft reminder untuk ketiganya?
        </p>
        <div className="chat-chips">
          <ChatChip primary onClick={() => onChip("buat-draft")}>Ya, buat draft reminder</ChatChip>
          <ChatChip onClick={() => onChip("riwayat")}>Tampilkan riwayat</ChatChip>
          <ChatChip onClick={() => onChip("manual")}>Telpon manual saja</ChatChip>
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
          Proyeksi cashflow 7 hari ke depan: <strong>Rp 4,2 M</strong> diharapkan masuk dari 18 invoice
          yang jatuh tempo. <span className="danger">3 invoice berisiko telat</span> jika tidak ada follow-up.
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
          Piutang bulan ini <strong>Rp 11,7 M</strong> — naik <span style={{ color: "var(--color-warning-text)", fontWeight: 600 }}>+18%</span> dari bulan lalu (Rp 9,9 M).
          Sebagian besar peningkatan dari segmen <strong>Distribusi</strong> (4 customer baru).
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
        <p>
          Saya belum bisa menjawab "{text}" secara spesifik di prototipe ini, tapi saya bisa bantu hal-hal berikut:
        </p>
        <div className="chat-chips">
          <ChatChip>Customer paling sering telat</ChatChip>
          <ChatChip>Proyeksi cashflow</ChatChip>
          <ChatChip>Bandingkan dengan bulan lalu</ChatChip>
        </div>
      </>
    ),
  };
}

// Route a user message to the right canned response
function routeResponse(text, top, totalOverdue, onChip) {
  const t = text.toLowerCase();
  if (t.includes("telat") || t.includes("sering") || t.includes("customer mana")) {
    return makeTopCustomersResponse(top, totalOverdue, onChip);
  }
  if (t.includes("cashflow") || t.includes("proyeksi") || t.includes("7 hari")) {
    return makeCashflowResponse();
  }
  if (t.includes("reminder") || t.includes("template")) {
    return makeReminderTemplateResponse(top[0]?.name?.split(/\s+/).slice(0, 3).join(" ") || "Customer");
  }
  if (t.includes("bulan lalu") || t.includes("bandingkan") || t.includes("mom")) {
    return makeMoMResponse();
  }
  return makeDefaultResponse(text);
}

// ── Drawer ────────────────────────────────────────────────────────────────

export default function AiChatDrawer({ open, onClose, initialQuestion, onConsumedInitialQuestion }) {
  const { invoices } = useInvoices();
  const { top, totalOverdue } = useMemo(() => computeTopCustomers(invoices), [invoices]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const convoRef = useRef(null);

  // Suggested questions — derived from data (top customer's short name)
  const suggestions = useMemo(() => {
    const reminderTarget = top[0] ? shortName(top[0].name) : "customer top";
    return [
      "Customer mana yang paling sering telat?",
      "Bagaimana proyeksi cashflow 7 hari ke depan?",
      `Buatkan template reminder untuk ${reminderTarget}`,
      "Bandingkan piutang bulan ini vs bulan lalu",
    ];
  }, [top]);

  // Welcome message — re-render when suggestions change
  useEffect(() => {
    if (!open) return;
    if (messages.length > 0) return;
    setMessages([
      {
        role: "ai",
        content: (
          <>
            <p>Halo Sarah — saya sudah membaca data piutang Anda hari ini. Mau saya bantu apa? Beberapa hal yang bisa saya jawab:</p>
            <div className="ai-suggestions">
              {suggestions.map((q, i) => (
                <button key={i} className="ai-suggestion" onClick={() => sendUserMessage(q)}>
                  {q}
                  <span className="ai-suggestion-arrow">→</span>
                </button>
              ))}
            </div>
          </>
        ),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestions.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (convoRef.current) convoRef.current.scrollTop = convoRef.current.scrollHeight;
  }, [messages, typing]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Seed question (from Summary drawer click) — auto-send shortly after the
  // welcome bubble renders, then clear it so it doesn't replay.
  useEffect(() => {
    if (!open || !initialQuestion) return;
    const id = setTimeout(() => {
      sendUserMessage(initialQuestion);
      onConsumedInitialQuestion && onConsumedInitialQuestion();
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  function handleChip(action) {
    if (action === "buat-draft") {
      sendUserMessage("Ya, buat draft reminder");
    } else if (action === "riwayat") {
      sendUserMessage("Tampilkan riwayat penagihan");
    } else if (action === "manual") {
      sendUserMessage("Saya akan telpon manual saja");
    }
  }

  function sendUserMessage(text) {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = routeResponse(text, top, totalOverdue, handleChip);
      setTyping(false);
      setMessages((prev) => [...prev, reply]);
    }, 900);
  }

  function onSubmit(e) {
    e.preventDefault();
    sendUserMessage(input);
  }

  return (
    <aside className={`ai-drawer${open ? " open" : ""}`} aria-hidden={!open}>
      {/* Header */}
      <div className="ai-dh">
        <div className="ai-dh-icon">
          <SparkleIcon />
          <span className="ai-dh-status-dot" />
        </div>
        <div className="ai-dh-body">
          <div className="ai-dh-title">Klay AI</div>
          <div className="ai-dh-meta">
            <span className="ai-dh-meta-dot" />
            terhubung · konteks: Invoices
          </div>
        </div>
        <button className="ai-dh-btn" title="Riwayat percakapan">
          <svg viewBox="0 0 14 14"><path d="M2 2h10v10H2z M5 5h4 M5 7h4 M5 9h3"/></svg>
        </button>
        <button className="ai-dh-btn" title="Tutup" onClick={onClose}>
          <svg viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8"/></svg>
        </button>
      </div>

      {/* Conversation */}
      <div className="ai-convo" ref={convoRef}>
        {messages.map((m, i) =>
          m.role === "ai" ? (
            <AiBubble key={i}>{m.content}</AiBubble>
          ) : (
            <UserBubble key={i}>{m.content}</UserBubble>
          ),
        )}
        {typing && (
          <AiBubble><TypingDots /></AiBubble>
        )}
      </div>

      {/* Input */}
      <div className="ai-input-wrap">
        <form className="ai-input-row" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya apapun tentang piutang…"
          />
          <button type="button" className="ai-input-attach" title="Lampirkan file">
            <svg viewBox="0 0 14 14"><path d="M9.5 4L4 9.5a1.5 1.5 0 102.1 2.1l5.4-5.4a3 3 0 10-4.2-4.2L2 7.3"/></svg>
          </button>
          <button type="submit" className="ai-input-send" disabled={!input.trim() || typing}>
            <svg viewBox="0 0 14 14"><path d="M2 7L11 2 7 12 6 8 2 7z"/></svg>
          </button>
        </form>
        <div className="ai-input-meta">
          <span>Klay AI hanya melihat data perusahaan Anda</span>
          <span>haiku-4-5</span>
        </div>
      </div>
    </aside>
  );
}
