import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getAuthorDashboard, type AuthorManuscript } from "@/lib/author-dashboard.functions";

export function AuthorDashboard({ email }: { email: string }) {
  const [papers, setPapers] = useState<AuthorManuscript[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setPapers(null);
    setRefreshing(true);
    setError("");
    try {
      const rows = await getAuthorDashboard();
      setPapers(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your edits.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setPapers(null);
    setError("");
    setRefreshing(true);
    getAuthorDashboard()
      .then((rows) => {
        if (active) setPapers(rows);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load your edits.");
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [email, load]);

  return (
    <section className="mt-10 border-t-2 border-primary pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Your Manuscripts</p>
          <h2 className="mt-2 font-serif text-3xl text-primary">Recent edits and revisions</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="border border-primary px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh papers"}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {!papers && !error && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {papers?.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No manuscripts on this student account yet.
        </p>
      )}
      <ul className="mt-5 space-y-5">
        {papers?.map((paper) => (
          <li key={paper.id} className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl text-primary">{paper.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {paper.status} · version {paper.currentVersion} · updated{" "}
                  {new Date(paper.submittedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-accent">
                  Version {paper.currentVersion} submitted successfully
                </p>
                {paper.manuscriptUrl && (
                  <a
                    className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
                    href={paper.manuscriptUrl}
                  >
                    Open current manuscript
                    {paper.manuscriptFilename ? `: ${paper.manuscriptFilename}` : ""}
                  </a>
                )}
              </div>
              {paper.resubmitToken && (
                <Link
                  to="/resubmit"
                  search={{ token: paper.resubmitToken }}
                  className="bg-primary px-4 py-2 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:bg-accent"
                >
                  Resubmit revision
                </Link>
              )}
            </div>

            {paper.feedback.length > 0 ? (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                  Edits requested
                </p>
                <ul className="mt-2 space-y-3">
                  {paper.feedback.map((item) => (
                    <li
                      key={`${item.source}-${item.id}`}
                      className="border-l-2 border-accent bg-background px-4 py-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {item.source} · {new Date(item.sentAt).toLocaleString()}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {item.body}
                      </p>
                      {item.fileUrl && (
                        <a
                          href={item.fileUrl}
                          className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
                        >
                          Download reviewer file{item.fileName ? `: ${item.fileName}` : ""}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : paper.status === "waiting for edits" ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Edits have been requested. Check the editor email for details while your account
                history updates.
              </p>
            ) : null}

            {paper.versions.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
                  Submitted versions
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {paper.versions.map((version) => (
                    <li key={version.id}>
                      v{version.version} · {version.filename} ·{" "}
                      {new Date(version.createdAt).toLocaleDateString()}
                      {version.note ? (
                        <p className="ml-4 whitespace-pre-wrap italic">Your note: {version.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
