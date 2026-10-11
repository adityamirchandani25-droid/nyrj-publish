import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { chatAssistant } from "@/lib/chat.functions";
import { developerToken, getSession, isDeveloper, onAuthChange, type Session } from "@/lib/auth";
import { verifyDeveloperAccess } from "@/lib/developer-auth.functions";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [{ title: "Developer Tools — NYRJ" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ToolsPage,
});

type Message = { role: "user" | "assistant"; content: string };
type Mode = "nyrj" | "general";
type RateLimitMode = "normal" | "test" | "simulate";

function recentMessages(messages: Message[]): Message[] {
  const maxMessages = 16;
  const maxCharacters = 20000;
  const result: Message[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0 && result.length < maxMessages; index--) {
    const message = messages[index];
    if (characters + message.content.length > maxCharacters) break;
    result.unshift(message);
    characters += message.content.length;
  }
  return result;
}

function ToolsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<"checking" | "granted" | "denied">("checking");
  const [mode, setMode] = useState<Mode>("nyrj");
  const [includeDirectory, setIncludeDirectory] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxOutputTokens, setMaxOutputTokens] = useState("");
  const [rateLimitMode, setRateLimitMode] = useState<RateLimitMode>("normal");
  const [testQuotaLimit, setTestQuotaLimit] = useState("6");
  const [testQuotaWindowMinutes, setTestQuotaWindowMinutes] = useState("10");
  const [simulatedRetryMinutes, setSimulatedRetryMinutes] = useState("10");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    if (!isDeveloper(session) || !session?.developerToken) {
      setAccess("denied");
      return;
    }
    let active = true;
    setAccess("checking");
    verifyDeveloperAccess({ data: { token: session.developerToken } })
      .then(() => {
        if (active) setAccess("granted");
      })
      .catch(() => {
        if (active) setAccess("denied");
      });
    return () => {
      active = false;
    };
  }, [session]);

  function resetConversation() {
    setConversation([]);
    setMessages([]);
    setError(null);
    setElapsedMs(null);
  }

  function resetSettings() {
    setMode("nyrj");
    setIncludeDirectory(true);
    setIncludeHistory(true);
    setModel("");
    setSystemPrompt("");
    setTemperature("");
    setMaxOutputTokens("");
    setRateLimitMode("normal");
    setTestQuotaLimit("6");
    setTestQuotaWindowMinutes("10");
    setSimulatedRetryMinutes("10");
    resetConversation();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy || access !== "granted") return;
    if (model.trim() && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,79}$/.test(model.trim())) {
      setError("Enter a valid model ID (letters, numbers, dots, slashes, colons or dashes).");
      return;
    }
    if (
      temperature !== "" &&
      (!Number.isFinite(Number(temperature)) || Number(temperature) < 0 || Number(temperature) > 2)
    ) {
      setError("Temperature must be between 0 and 2.");
      return;
    }
    if (
      maxOutputTokens !== "" &&
      (!Number.isInteger(Number(maxOutputTokens)) ||
        Number(maxOutputTokens) < 64 ||
        Number(maxOutputTokens) > 2000)
    ) {
      setError("Max tokens must be a whole number from 64 to 2000.");
      return;
    }
    if (
      rateLimitMode === "test" &&
      (!Number.isInteger(Number(testQuotaLimit)) ||
        Number(testQuotaLimit) < 1 ||
        Number(testQuotaLimit) > 30 ||
        !Number.isInteger(Number(testQuotaWindowMinutes)) ||
        Number(testQuotaWindowMinutes) < 1 ||
        Number(testQuotaWindowMinutes) > 60)
    ) {
      setError("Test quota must be 1–30 requests in a 1–60 minute window.");
      return;
    }
    if (
      rateLimitMode === "simulate" &&
      (!Number.isInteger(Number(simulatedRetryMinutes)) ||
        Number(simulatedRetryMinutes) < 1 ||
        Number(simulatedRetryMinutes) > 60)
    ) {
      setError("Simulated retry time must be 1–60 minutes.");
      return;
    }
    const userMessage: Message = { role: "user", content };
    const next = [...conversation, userMessage];
    const payload = recentMessages(includeHistory ? next : [userMessage]);
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setBusy(true);
    const started = performance.now();
    try {
      const { reply } = await chatAssistant({
        data: {
          messages: payload,
          tools: {
            token: developerToken(),
            mode,
            includeDirectory,
            includeHistory,
            model: model.trim() || undefined,
            systemPrompt: systemPrompt.trim() || undefined,
            temperature: temperature === "" ? undefined : Number(temperature),
            maxOutputTokens: maxOutputTokens === "" ? undefined : Number(maxOutputTokens),
            rateLimitMode,
            testQuotaLimit: rateLimitMode === "test" ? Number(testQuotaLimit) : undefined,
            testQuotaWindowSeconds:
              rateLimitMode === "test" ? Number(testQuotaWindowMinutes) * 60 : undefined,
            simulatedRetrySeconds:
              rateLimitMode === "simulate" ? Number(simulatedRetryMinutes) * 60 : undefined,
          },
        },
      });
      const assistantMessage: Message = { role: "assistant", content: reply };
      setConversation(recentMessages([...payload, assistantMessage]));
      setMessages((current) => [...current, assistantMessage]);
      setElapsedMs(Math.round(performance.now() - started));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sage test failed.");
    } finally {
      setBusy(false);
    }
  }

  if (access !== "granted") {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Developer Tools</p>
          <h1 className="mt-3 font-serif text-4xl text-primary">
            {access === "checking" ? "Checking access…" : "Developer login required"}
          </h1>
          {access === "denied" && (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                Enter the developer code in Ask Sage to open the login.
              </p>
              <Link
                to="/"
                className="mt-6 inline-block bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-accent"
              >
                Return Home
              </Link>
            </>
          )}
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        <header>
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Developer Tools</p>
          <h1 className="mt-2 font-serif text-4xl text-primary">Ask Sage test bench</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Test Sage with custom model settings and rate-limit scenarios. Settings apply to this
            dashboard session only.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="h-fit space-y-5 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-2xl text-primary">Test settings</h2>
              <button
                type="button"
                onClick={resetSettings}
                disabled={busy}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-accent disabled:opacity-50"
              >
                Reset
              </button>
            </div>
            <Switch
              label="General chat mode"
              detail="Use the general GPT-4o mini prompt instead of the NYRJ guide."
              checked={mode === "general"}
              disabled={busy}
              onChange={(checked) => {
                setMode(checked ? "general" : "nyrj");
                resetConversation();
              }}
            />
            <Switch
              label="Live directory context"
              detail="Include current team and advisor details in NYRJ answers."
              checked={includeDirectory}
              disabled={busy || mode === "general"}
              onChange={(checked) => {
                setIncludeDirectory(checked);
                resetConversation();
              }}
            />
            <Switch
              label="Conversation history"
              detail="Send earlier turns with each test prompt."
              checked={includeHistory}
              disabled={busy}
              onChange={(checked) => {
                setIncludeHistory(checked);
                resetConversation();
              }}
            />
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                LLM settings
              </h3>
              <label className="block space-y-1 text-sm font-medium text-foreground">
                <span>Model ID</span>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={busy}
                  maxLength={80}
                  placeholder={mode === "general" ? "gpt-4o-mini" : "Server default"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm font-medium text-foreground">
                  <span>Temperature</span>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                    disabled={busy}
                    placeholder={mode === "general" ? "0.7" : "0.2"}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                </label>
                <label className="block space-y-1 text-sm font-medium text-foreground">
                  <span>Max tokens</span>
                  <input
                    type="number"
                    min="64"
                    max="2000"
                    step="1"
                    value={maxOutputTokens}
                    onChange={(event) => setMaxOutputTokens(event.target.value)}
                    disabled={busy}
                    placeholder={mode === "general" ? "1200" : "320"}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium text-foreground">
                <span>System prompt override</span>
                <textarea
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  disabled={busy}
                  maxLength={6000}
                  rows={4}
                  placeholder="Leave blank to use the selected mode's prompt"
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </label>
            </div>
            <label className="block space-y-1 border-t border-border pt-4 text-sm font-medium text-foreground">
              <span>Rate-limit test</span>
              <select
                value={rateLimitMode}
                onChange={(event) => setRateLimitMode(event.target.value as RateLimitMode)}
                disabled={busy}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus:border-accent focus:outline-none disabled:opacity-50"
              >
                <option value="normal">Enforce live quota</option>
                <option value="test">Use adjustable test quota</option>
                <option value="simulate">Simulate quota reached</option>
              </select>
            </label>
            {rateLimitMode === "test" && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block space-y-1 font-medium text-foreground">
                  <span>Requests</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={testQuotaLimit}
                    onChange={(event) => setTestQuotaLimit(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                </label>
                <label className="block space-y-1 font-medium text-foreground">
                  <span>Window (min)</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={testQuotaWindowMinutes}
                    onChange={(event) => setTestQuotaWindowMinutes(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                </label>
              </div>
            )}
            {rateLimitMode === "test" && (
              <p className="text-xs text-muted-foreground">
                A separate 30 requests/hour developer cap also applies.
              </p>
            )}
            {rateLimitMode === "simulate" && (
              <label className="block space-y-1 text-sm font-medium text-foreground">
                <span>Retry after (min)</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  value={simulatedRetryMinutes}
                  onChange={(event) => setSimulatedRetryMinutes(event.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </label>
            )}
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              Settings require developer access. Input and output safety checks stay active.
            </p>
          </aside>

          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-serif text-2xl text-primary">Conversation</h2>
                <p className="text-xs text-muted-foreground">
                  {mode === "general" ? "General" : "NYRJ guide"} ·{" "}
                  {model.trim() || (mode === "general" ? "gpt-4o-mini" : "server default")}
                  {elapsedMs !== null ? ` · Last response ${elapsedMs} ms` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={resetConversation}
                disabled={busy}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Clear chat
              </button>
            </div>

            <div
              className="max-h-[480px] min-h-72 space-y-3 overflow-y-auto px-5 py-5"
              aria-live="polite"
            >
              {messages.length === 0 && (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Choose a test prompt or write your own.</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "How do I submit a paper?",
                      "Who is on the NYRJ team?",
                      "Explain photosynthesis in simple terms.",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {busy && <p className="text-sm text-muted-foreground">Sage is responding…</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <form onSubmit={send} className="flex gap-3 border-t border-border p-4">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={4000}
                placeholder="Enter a test prompt…"
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <button
                disabled={busy || !input.trim()}
                className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground transition hover:bg-accent disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function Switch({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
      />
    </label>
  );
}
