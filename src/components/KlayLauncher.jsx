import { useEffect, useRef, useState } from "react";

const GREETINGS = [
  "Hi Sarah, let's bulldoze through the day",
  "Hey Sarah, what's on your mind?",
  "Welcome back, Sarah. Where should we start?",
  "Sarah! What can Klay help untangle?",
  "Morning, Sarah. Ready to dig in?",
  "Hi Sarah — let's get the books in shape",
  "What's the situation, Sarah?",
];

function pickGreeting() {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5l1.3 3.2L11.5 6l-3.2 1L7 10l-1.3-3L2.5 6l3.2-1.3L7 1.5z" />
      <path d="M11.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
    </svg>
  );
}

export default function KlayLauncher() {
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState(pickGreeting);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  // Listen for "open the launcher" events from anywhere (sidebar button, ⌘J)
  useEffect(() => {
    const onOpen = () => {
      setGreeting(pickGreeting());
      setValue("");
      setOpen(true);
    };
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        onOpen();
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("klay:open-launcher", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("klay:open-launcher", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus the input as soon as the overlay appears
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  function submit() {
    const q = value.trim();
    if (!q) return;
    window.dispatchEvent(new CustomEvent("klay:open-chat", { detail: { question: q } }));
    setOpen(false);
    setValue("");
  }

  if (!open) return null;
  return (
    <div className="klay-launcher-backdrop" onClick={() => setOpen(false)}>
      <div className="klay-launcher" onClick={(e) => e.stopPropagation()}>
        <div className="klay-launcher-greeting">
          <span className="klay-launcher-sparkle"><SparkleIcon /></span>
          {greeting}
        </div>
        <div className="klay-launcher-input-wrap">
          <input
            ref={inputRef}
            className="klay-launcher-input"
            placeholder="Ask Klay anything — try ‘which customers are over 60 days late’"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
            }}
          />
          <button type="button" className="klay-launcher-send" onClick={submit} aria-label="Ask Klay">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 7h10M8 3l4 4-4 4" />
            </svg>
          </button>
        </div>
        <div className="klay-launcher-hint">
          <span><kbd>↵</kbd> send</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
