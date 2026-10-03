import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { createRevisionUpload, finalizeRevision, getResubmitInfo } from "@/lib/editors.functions";

export const Route = createFileRoute("/resubmit")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Upload Your Revised Manuscript — NYRJ" },
      {
        name: "description",
        content: "Attach your revised manuscript to your existing NYRJ submission.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResubmitPage,
});

const btn =
  "px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50";

function ResubmitPage() {
  const { token } = Route.useSearch();
  const [info, setInfo] = useState<{
    title: string;
    version: number;
    status: string;
    requestedEdits: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError("This upload link is missing its code. Please use the link in our email.");
      return;
    }
    getResubmitInfo({ data: { token } })
      .then(setInfo)
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : "This upload link is no longer valid."),
      );
  }, [token]);

  async function upload() {
    if (!file) {
      setError("Please choose your revised file first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file for the revised manuscript.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signed = await createRevisionUpload({ data: { token, filename: file.name } });
      const { error: upErr } = await supabase.storage
        .from("submissions")
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) throw new Error(upErr.message);
      const res = await finalizeRevision({
        data: {
          token,
          path: signed.path,
          filename: file.name,
          expectedVersion: signed.expectedVersion,
          note,
        },
      });
      setDone(res.version);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't upload that file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Revised Manuscript</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Upload your revision</h1>

        {loadError && (
          <p className="mt-6 border-l-4 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </p>
        )}

        {!info && !loadError && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

        {info && done === null && (
          <div className="mt-6 space-y-5">
            <div className="border border-border bg-card p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Your submission</p>
              <p className="font-serif text-xl text-primary mt-1">{info.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Current version: v{info.version} · {info.status}
              </p>
            </div>
            {info.requestedEdits && (
              <div className="border-l-2 border-accent bg-card px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                  Requested edits
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {info.requestedEdits}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Your title, authors, abstract, declarations, reviewer assignment, and all other
              submission details are already saved. This replaces only the current manuscript PDF on
              the same paper — it does not create a new submission or assign a new initial reviewer.
            </p>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Revised file</p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                Note for our editors (optional)
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
                placeholder="Anything you'd like us to know about your changes…"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button className={btn} disabled={busy} onClick={() => void upload()}>
              {busy ? "Uploading…" : "Send revised manuscript"}
            </button>
          </div>
        )}

        {done !== null && (
          <div className="mt-6 border border-border bg-card p-6">
            <p className="font-serif text-2xl text-primary">Thank you — we have it.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your revision was received as version {done}. Our editors will take it from here, and
              you'll hear from us with the next step.
            </p>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
