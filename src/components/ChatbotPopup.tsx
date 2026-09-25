import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { chatAssistant } from "@/lib/chat.functions";

type Msg = { role: "user" | "assistant"; content: string };

const INTRO: Msg = {
  role: "assistant",
  content:
    "Hi, welcome to NYRJ! I'm Sage, your guide here. 👋 Ask me anything — submitting a manuscript, peer review, DOIs, chapters, events, or our team. No question is too small, and if you'd rather talk to a real person I can point you there too. What are you working on?",
};

const SUGGESTIONS = [
  "How do I submit my paper?",
  "How does peer review work?",
  "What is an ORCID and why do I need one?",
  "How do I talk to a human?",
];

export function ChatbotPopup() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  async function ask(text: string) {
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const payload = next
        .filter((m) => m !== INTRO)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await chatAssistant({ data: { messages: payload } });
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(/unauthorized/i.test(msg) ? "Please sign in to chat with Sage." : msg);
    } finally {
      setBusy(false);
    }
  }

  function send(e: FormEvent) {
    e.preventDefault();
    void ask(input.trim());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Ask Sage" : "Open Ask Sage"}
        className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary py-3 pl-4 pr-5 text-primary-foreground shadow-xl transition-all hover:bg-accent hover:shadow-2xl hover:-translate-y-0.5"
      >
        <span
          aria-hidden
          className="animate-nyrj-glow pointer-events-none absolute inset-0 -z-10 rounded-full bg-accent/40 blur-xl"
        />
        {open ? (
          <X size={20} />
        ) : (
          <Sparkles size={20} className="animate-nyrj-float" />
        )}
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">
          {open ? "Close" : "Ask Sage"}
        </span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(580px,calc(100vh-8rem))] w-[min(390px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="relative overflow-hidden bg-primary px-4 py-4 text-primary-foreground">
            <span
              aria-hidden
              className="animate-nyrj-glow pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/40 blur-2xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sparkles size={18} className="animate-nyrj-float" />
              </span>
              <div>
                <p className="font-serif text-lg leading-tight">Ask Sage</p>
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">
                  NYRJ AI guide · always on
                </p>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "ml-auto rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-primary-foreground"
                    : "mr-auto rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-foreground"
                }`}
              >
                {m.role === "assistant" ? renderWithLinks(m.content) : m.content}
              </div>
            ))}

            {messages.length === 1 && !busy && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/80 transition hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {busy && (
              <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/50"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            {error && (
              <div className="mr-auto rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Sage anything…"
              maxLength={1000}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-accent disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// Turn Markdown-style [label](/path) links in assistant replies into clickable
// same-origin links. We only allow paths that start with "/" so nothing external
// can be injected via the model output.
function renderWithLinks(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\((\/[a-zA-Z0-9/_\-.$?=&#]*)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, label, href] = match;
    parts.push(
      <a
        key={`lnk-${key++}`}
        href={href}
        className="mt-1 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground no-underline transition hover:opacity-90"
      >
        {label} →
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
