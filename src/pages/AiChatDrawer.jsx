import { useState, useEffect, useRef } from "react";

// Generic chat-drawer shell. Pages provide their own AI context via props:
//   welcome     — JSX rendered as the AI's first bubble
//   suggestions — array of strings shown as clickable follow-ups inside the
//                 welcome bubble. Each is also a valid user message.
//   respond     — (text) => { role: 'ai', content: <JSX> } — returns the AI's
//                 message for a given user utterance. Pages can branch on
//                 keywords to surface different stubbed responses.

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

function TypingDots() {
  return (
    <span className="ai-typing">
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
    </span>
  );
}

// Re-exported so pages can render chips inside their AI responses
export function ChatChip({ children, primary, onClick }) {
  return (
    <button className={`chat-chip${primary ? " primary" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function AiChatDrawer({
  open,
  onClose,
  initialQuestion,
  onConsumedInitialQuestion,
  context = {},
  contextLabel = "Invoices",
}) {
  const { welcome, suggestions = [], respond } = context;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const convoRef = useRef(null);

  // Reset conversation when the drawer is closed
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput("");
      setTyping(false);
    }
  }, [open]);

  // Welcome bubble — only shown once per open
  useEffect(() => {
    if (!open) return;
    if (messages.length > 0) return;
    setMessages([
      {
        role: "ai",
        content: (
          <>
            {welcome}
            {suggestions.length > 0 && (
              <div className="ai-suggestions">
                {suggestions.map((q, i) => (
                  <button key={i} className="ai-suggestion" onClick={() => sendUserMessage(q)}>
                    {q}
                    <span className="ai-suggestion-arrow">→</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, welcome, suggestions.length]);

  // Scroll on new message / typing change
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

  // Seed question (from Summary drawer click)
  useEffect(() => {
    if (!open || !initialQuestion) return;
    const id = setTimeout(() => {
      sendUserMessage(initialQuestion);
      onConsumedInitialQuestion && onConsumedInitialQuestion();
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  function sendUserMessage(text) {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = respond
        ? respond(text, { send: sendUserMessage })
        : { role: "ai", content: <p>(Tidak ada konteks AI untuk halaman ini.)</p> };
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
            terhubung · konteks: {contextLabel}
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
          m.role === "ai" ? <AiBubble key={i}>{m.content}</AiBubble> : <UserBubble key={i}>{m.content}</UserBubble>,
        )}
        {typing && <AiBubble><TypingDots /></AiBubble>}
      </div>

      {/* Input */}
      <div className="ai-input-wrap">
        <form className="ai-input-row" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya apapun tentang halaman ini…"
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

// Re-exported atoms — pages can render their own message JSX with these
export { AiBubble, UserBubble, SparkleIcon };
