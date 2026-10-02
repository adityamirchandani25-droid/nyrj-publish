import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { getSession, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";
import { addEntry } from "@/lib/library";
import {
  addManuscriptToLibrary,
  listManuscriptSubmissions,
  listTrashedManuscriptSubmissions,
  purgeManuscriptSubmission,
  restoreManuscriptSubmission,
  signManuscriptDownload,
  trashManuscriptSubmission,
  updateManuscriptSubmission,
} from "@/lib/manuscript-admin.functions";
import { PeerReviewPanel } from "@/components/PeerReviewPanel";
import { ReviewerAccounts, AuditLogView } from "@/components/ReviewerAdmin";
import { InitialReviewers } from "@/components/InitialReviewers";
import { EditorAdmin } from "@/components/EditorAdmin";
import { SentEmails } from "@/components/SentEmails";
import { VersionHistory } from "@/components/VersionHistory";

export const Route = createFileRoute("/admin/submissions")({
  head: () => ({
    meta: [
      { title: "Manuscript Submissions — NYRJ Staff" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSubmissions,
});

type Row = Awaited<ReturnType<typeof listManuscriptSubmissions>>[number];

const STATUS_OPTIONS = [
  "pending / in review",
  "initial review",
  "editorial review",
  "waiting for edits",
  "secondary review",
  "publishing",
  "published",
] as const;

const DECISION_OPTIONS = ["pending", "accepted", "declined"] as const;

function AdminSubmissions() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<"active" | "trash" | "reviewers" | "editors" | "emails" | "audit">(
    "active",
  );
  const [rows, setRows] = useState<Row[] | null>(null);
  const [trashed, setTrashed] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [libraryFor, setLibraryFor] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [reviewerRefreshKey, setReviewerRefreshKey] = useState(0);

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  async function refresh() {
    setError(null);
    try {
      const [active, bin] = await Promise.all([
        listManuscriptSubmissions({ data: { staffToken: staffToken() } }),
        listTrashedManuscriptSubmissions({ data: { staffToken: staffToken() } }),
      ]);
      setRows(active);
      setTrashed(bin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load submissions.");
    }
  }

  useEffect(() => {
    if (isStaff(session)) void refresh();
  }, [session]);

  if (!isStaff(session)) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Staff Only</p>
          <h1 className="font-serif text-4xl text-primary mt-3">Manuscript Submissions</h1>
          <p className="mt-4 text-muted-foreground">
            You need to be signed in as staff to view manuscript submissions.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent"
          >
            Staff Login
          </a>
        </section>
      </SiteLayout>
    );
  }

  async function saveField(id: string, patch: { status?: string; decision?: string }) {
    setSavingId(id);
    try {
      await updateManuscriptSubmission({
        data: { staffToken: staffToken(), id, ...patch },
      });
      setRows((cur) => cur?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? cur);
      if (patch.decision) setReviewerRefreshKey((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function downloadFile(path: string, filename: string) {
    try {
      const { url } = await signManuscriptDownload({
        data: { staffToken: staffToken(), path },
      });
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }

  async function moveToTrash(id: string) {
    if (!window.confirm("Move this submission to Trash? Editors can restore it within 30 days."))
      return;
    try {
      await trashManuscriptSubmission({ data: { staffToken: staffToken(), id } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function restore(id: string) {
    try {
      await restoreManuscriptSubmission({ data: { staffToken: staffToken(), id } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    }
  }

  async function purge(id: string) {
    if (!window.confirm("Permanently delete this submission? This cannot be undone.")) return;
    try {
      await purgeManuscriptSubmission({ data: { staffToken: staffToken(), id } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  const isListTab = tab === "active" || tab === "trash";
  const visibleRows = tab === "active" ? rows : tab === "trash" ? trashed : null;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Staff Dashboard</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Manuscript Submissions</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Every submission from the on-site form. Change status or decision — updates appear on the
          author's Track Submissions page immediately.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "active" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Active {rows ? `(${rows.length})` : ""}
          </button>
          <button
            onClick={() => setTab("trash")}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "trash" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Trash {trashed ? `(${trashed.length})` : ""}
          </button>
          <button
            onClick={() => setTab("reviewers")}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "reviewers" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Peer Reviewers
          </button>
          <button
            onClick={() => setTab("editors")}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "editors" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Editors
          </button>
          <button
            onClick={() => setTab("emails")}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "emails" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Emails Sent
          </button>
          <button
            onClick={() => setTab("audit")}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "audit" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Audit Log
          </button>
          <button
            onClick={() => setShowManual((v) => !v)}
            className={`ml-auto px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${showManual ? "bg-accent text-accent-foreground border-accent" : "border-accent text-accent hover:bg-accent hover:text-accent-foreground"}`}
          >
            {showManual ? "Cancel Manual Add" : "+ Manually Add to Library"}
          </button>
        </div>

        {showManual && <ManualLibraryAddForm onDone={() => setShowManual(false)} />}

        {tab === "trash" && (
          <p className="mt-4 text-xs text-muted-foreground italic">
            Items in Trash are visible only to editors and are permanently removed after 30 days.
          </p>
        )}

        {error && (
          <p className="mt-6 border-l-4 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {tab === "reviewers" && <ReviewerAccounts />}
        {tab === "editors" && <EditorAdmin />}
        {tab === "emails" && <SentEmails />}
        {tab === "audit" && <AuditLogView />}

        {isListTab && !visibleRows && !error && (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        )}

        {visibleRows && visibleRows.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground italic">
            {tab === "active" ? "No submissions yet." : "Trash is empty."}
          </p>
        )}

        {visibleRows && visibleRows.length > 0 && (
          <div className="mt-8 space-y-3">
            {visibleRows.map((r) => (
              <article key={r.id} className="border border-border bg-card">
                <header className="p-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg text-primary truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.submitter_email} · {r.research_type ?? "—"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString()}
                      {tab === "trash" && r.deleted_at && (
                        <> · trashed {new Date(r.deleted_at).toLocaleDateString()}</>
                      )}
                    </p>
                    <p className="text-xs mt-1">
                      {r.initial_reviewer_name?.trim() ? (
                        <span className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                          Initial reviewer: {r.initial_reviewer_name}
                          {r.initial_reviewer_email ? ` (${r.initial_reviewer_email})` : ""}
                          {r.initial_reviewer_assigned_at
                            ? ` · assigned ${new Date(r.initial_reviewer_assigned_at).toLocaleDateString()}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Initial reviewer: unassigned
                        </span>
                      )}
                    </p>
                  </div>

                  {tab === "active" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Status
                        <select
                          value={r.status}
                          disabled={savingId === r.id}
                          onChange={(e) => void saveField(r.id, { status: e.target.value })}
                          className="ml-2 border border-border bg-background px-2 py-1 text-xs normal-case tracking-normal"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Decision
                        <select
                          value={r.decision}
                          disabled={savingId === r.id}
                          onChange={(e) => void saveField(r.id, { decision: e.target.value })}
                          className="ml-2 border border-border bg-background px-2 py-1 text-xs normal-case tracking-normal"
                        >
                          {DECISION_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="px-3 py-1 border border-border text-[10px] uppercase tracking-[0.18em] hover:bg-muted"
                      >
                        {expanded === r.id ? "Hide" : "Details"}
                      </button>
                    </div>
                  )}
                  {tab === "trash" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void restore(r.id)}
                        className="px-3 py-1 border border-accent text-accent text-[10px] uppercase tracking-[0.18em] hover:bg-accent hover:text-accent-foreground"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => void purge(r.id)}
                        className="px-3 py-1 border border-destructive text-destructive text-[10px] uppercase tracking-[0.18em] hover:bg-destructive hover:text-destructive-foreground"
                      >
                        Delete Forever
                      </button>
                    </div>
                  )}
                </header>

                {tab === "active" && (
                  <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      onClick={() => setLibraryFor(libraryFor === r.id ? null : r.id)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.18em] hover:bg-accent"
                    >
                      {libraryFor === r.id ? "Cancel" : "+ Add to Library"}
                    </button>
                    <button
                      onClick={() => setReviewFor(reviewFor === r.id ? null : r.id)}
                      className="px-3 py-1.5 border border-accent text-accent text-[11px] uppercase tracking-[0.18em] hover:bg-accent hover:text-accent-foreground"
                    >
                      {reviewFor === r.id ? "Hide Peer Review" : "Peer Review"}
                    </button>
                    <button
                      onClick={() => void moveToTrash(r.id)}
                      className="px-3 py-1.5 border border-destructive text-destructive text-[11px] uppercase tracking-[0.18em] hover:bg-destructive hover:text-destructive-foreground"
                    >
                      🗑 Move to Trash
                    </button>
                  </div>
                )}

                {tab === "active" && reviewFor === r.id && <PeerReviewPanel submissionId={r.id} />}

                {tab === "active" && libraryFor === r.id && (
                  <AddToLibraryForm
                    row={r}
                    onDone={() => {
                      setLibraryFor(null);
                    }}
                  />
                )}

                {tab === "active" && expanded === r.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-border text-sm space-y-4">
                    <VersionHistory submissionId={r.id} />
                    {r.manuscript_path && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                          Manuscript file
                        </p>
                        <button
                          onClick={() =>
                            void downloadFile(
                              r.manuscript_path as string,
                              r.manuscript_filename ?? "manuscript",
                            )
                          }
                          className="mt-1 px-3 py-1.5 bg-accent text-accent-foreground text-[11px] uppercase tracking-[0.18em] hover:opacity-90"
                        >
                          ↓ {r.manuscript_filename ?? "Download Manuscript"}
                        </button>
                      </div>
                    )}

                    {Array.isArray(r.supplementary_paths) && r.supplementary_paths.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                          Additional files
                        </p>
                        <ul className="mt-1 space-y-2 text-xs">
                          {(
                            r.supplementary_paths as Array<{
                              path: string;
                              filename: string;
                              description?: string;
                            }>
                          ).map((f, i) => (
                            <li key={i} className="border border-border p-2 bg-background">
                              <button
                                onClick={() => void downloadFile(f.path, f.filename)}
                                className="text-accent underline underline-offset-2 hover:text-primary"
                              >
                                ↓ {f.filename}
                              </button>
                              {f.description && (
                                <p className="mt-1 text-muted-foreground italic">{f.description}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(r.consent_form_paths) && r.consent_form_paths.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                          Consent form files
                        </p>
                        <ul className="mt-1 space-y-1 text-xs">
                          {(r.consent_form_paths as Array<{ path: string; filename: string }>).map(
                            (f, i) => (
                              <li key={i}>
                                <button
                                  onClick={() => void downloadFile(f.path, f.filename)}
                                  className="text-accent underline underline-offset-2 hover:text-primary"
                                >
                                  ↓ {f.filename}
                                </button>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Title</p>
                      <p className="mt-1 text-xs">{r.title}</p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                        Research type
                      </p>
                      <p className="mt-1 text-xs">
                        {r.research_type ?? "—"}
                        {r.research_type === "Other" && r.research_type_other
                          ? ` — ${r.research_type_other}`
                          : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                        Abstract
                      </p>
                      <p className="mt-1 whitespace-pre-line text-xs">
                        {r.abstract || (
                          <span className="text-muted-foreground italic">(none provided)</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Authors</p>
                      <ol className="mt-1 space-y-3 list-decimal pl-5">
                        {Array.isArray(r.authors) &&
                          (r.authors as Array<Record<string, string>>).map((a, i) => (
                            <li key={i} className="text-xs">
                              <p className="font-medium text-primary">{a.name || "—"}</p>
                              <dl className="mt-1 grid grid-cols-[110px_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
                                <dt>Email</dt>
                                <dd>{a.email || "—"}</dd>
                                <dt>Institution</dt>
                                <dd>{a.institution || "—"}</dd>
                                <dt>ORCID</dt>
                                <dd>{a.orcid || "—"}</dd>
                                <dt>Address</dt>
                                <dd>{a.address || "—"}</dd>
                                <dt>City</dt>
                                <dd>{a.city || "—"}</dd>
                                <dt>State/Region</dt>
                                <dd>{a.state || "—"}</dd>
                                <dt>ZIP/Postal</dt>
                                <dd>{a.zip || "—"}</dd>
                                <dt>Nation</dt>
                                <dd>{a.nation || "—"}</dd>
                                <dt>Inst. address</dt>
                                <dd>{a.institutionAddress || "—"}</dd>
                              </dl>
                            </li>
                          ))}
                      </ol>
                    </div>

                    <DeclarationRow
                      label="Conflict of interest"
                      value={r.conflict_of_interest}
                      detail={r.conflict_explanation}
                    />
                    <DeclarationRow
                      label="Funding received"
                      value={r.funding}
                      detail={r.funding_source}
                    />
                    <DeclarationRow
                      label="Used generative AI"
                      value={r.used_gen_ai}
                      detail={r.gen_ai_explanation}
                    />
                    <DeclarationRow label="Work is original" value={r.is_original} detail={null} />
                    <DeclarationRow
                      label="Not under consideration elsewhere"
                      value={r.not_under_consideration}
                      detail={null}
                    />
                    <DeclarationRow
                      label="Includes human / vertebrate subjects"
                      value={r.has_human_or_vertebrate}
                      detail={null}
                    />

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                        Data availability
                      </p>
                      <p className="mt-1 text-xs">
                        {r.data_availability === "openly_available_online"
                          ? "Openly available online"
                          : r.data_availability === "available_on_request"
                            ? "Available to editors on request"
                            : r.data_availability === "not_available"
                              ? "Not openly available"
                              : "—"}
                      </p>
                    </div>

                    <DeclarationRow
                      label="All authors consent to submission"
                      value={r.all_authors_consent}
                      detail={null}
                    />

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                        Comments to editors
                      </p>
                      <p className="mt-1 whitespace-pre-line text-xs">
                        {r.comments || <span className="text-muted-foreground italic">(none)</span>}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {tab === "active" && <InitialReviewers refreshKey={reviewerRefreshKey} />}
      </section>
    </SiteLayout>
  );
}

function AddToLibraryForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const authorList = Array.isArray(row.authors)
    ? (row.authors as Array<{ name?: string; orcid?: string; email?: string }>)
    : [];
  const initialAuthors = authorList
    .map((a) => a?.name)
    .filter(Boolean)
    .join(", ");
  const initialOrcids = authorList
    .map((a) => (a?.orcid ?? "").replace(/^https?:\/\/orcid\.org\//i, "").trim())
    .filter(Boolean)
    .join(", ");
  const today = new Date().toISOString().slice(0, 10);
  const initialTopic =
    (row.research_domain && row.research_domain.trim()) ||
    (row.research_type === "other" ? (row.research_type_other ?? "") : (row.research_type ?? ""));

  const [title, setTitle] = useState(row.title);
  const [authors, setAuthors] = useState(initialAuthors);
  const [issue, setIssue] = useState(`Vol. I · ${new Date().getFullYear()}`);
  const [topic, setTopic] = useState(initialTopic);
  const [doi, setDoi] = useState("");
  const [orcids, setOrcids] = useState(initialOrcids);
  const [abstract, setAbstract] = useState(row.abstract ?? "");
  const [keywords, setKeywords] = useState(row.keywords ?? "");
  const [publicationDate, setPublicationDate] = useState(today);
  const [awardWinner, setAwardWinner] = useState(false);
  const [awardLabel, setAwardLabel] = useState("");
  const [featured, setFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await addManuscriptToLibrary({
        data: {
          staffToken: staffToken(),
          id: row.id,
          title: title.trim(),
          authors: authors.trim(),
          issue: issue.trim() || undefined,
          topic: topic.trim() || undefined,
          doi: doi.trim() || undefined,
          orcids: orcids.trim() || undefined,
          awardWinner,
          awardLabel: awardWinner ? awardLabel.trim() || undefined : undefined,
          featured,
          abstract: abstract.trim() || undefined,
          keywords: keywords.trim() || undefined,
          publicationDate: publicationDate || undefined,
          authorEmail: row.submitter_email || undefined,
        },
      });
      setMsg("Published to Library.");
      setTimeout(onDone, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add to library.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-border bg-muted/30 p-4 space-y-3 text-xs">
      <p className="uppercase tracking-[0.2em] text-accent">Publish to Library</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Author(s)
          </span>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            required
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Issue
          </span>
          <input
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Vol. I · Issue 1"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Topic
          </span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">DOI</span>
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.xxxx/xxxxxx"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Publication date
          </span>
          <input
            type="date"
            value={publicationDate}
            onChange={(e) => setPublicationDate(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            ORCID(s) — comma or space separated
          </span>
          <input
            value={orcids}
            onChange={(e) => setOrcids(e.target.value)}
            placeholder="0000-0002-1825-0097, 0000-0001-2345-6789"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Keywords (comma separated)
          </span>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Abstract
          </span>
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={4}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={awardWinner}
          onChange={(e) => setAwardWinner(e.target.checked)}
        />
        <span>🏆 Mark as Award Winner</span>
      </label>
      {awardWinner && (
        <input
          value={awardLabel}
          onChange={(e) => setAwardLabel(e.target.value)}
          placeholder="Award label (optional)"
          className="w-full border border-border bg-background px-2 py-1.5"
        />
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        <span>⭐ Feature on home page</span>
      </label>
      {err && <p className="text-destructive">{err}</p>}
      {msg && <p className="text-accent">{msg}</p>}
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 bg-primary text-primary-foreground uppercase tracking-[0.18em] hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Publishing…" : "Publish to Library"}
      </button>
    </form>
  );
}

function DeclarationRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: boolean;
  detail: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{label}</p>
      <p className="mt-1 text-xs">
        <span className={value ? "text-primary font-medium" : "text-muted-foreground"}>
          {value ? "Yes" : "No"}
        </span>
        {value && detail ? ` — ${detail}` : ""}
      </p>
    </div>
  );
}

function ManualLibraryAddForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [issue, setIssue] = useState("");
  const [topic, setTopic] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [keywords, setKeywords] = useState("");
  const [doi, setDoi] = useState("");
  const [orcids, setOrcids] = useState("");
  const [awardWinner, setAwardWinner] = useState(false);
  const [awardLabel, setAwardLabel] = useState("");
  const [featured, setFeatured] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setAuthors("");
    setIssue("");
    setTopic("");
    setAuthorEmail("");
    setKeywords("");
    setDoi("");
    setOrcids("");
    setAwardWinner(false);
    setAwardLabel("");
    setFeatured(false);
    setFile(null);
    setFileKey((k) => k + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!file) {
      setErr("Please select a PDF or Word file.");
      return;
    }
    setBusy(true);
    try {
      await addEntry({
        title: title.trim(),
        authors: authors.trim(),
        issue: issue.trim() || undefined,
        topic: topic.trim() || undefined,
        authorEmail: authorEmail.trim() || undefined,
        keywords: keywords
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        doi: doi.trim() || undefined,
        orcids: orcids
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        awardWinner,
        awardLabel: awardWinner ? awardLabel.trim() || undefined : undefined,
        featured,
        file,
      });
      setMsg("Added to Library.");
      reset();
      setTimeout(onDone, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add to library.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 border border-accent bg-muted/30 p-4 space-y-3 text-xs">
      <p className="uppercase tracking-[0.2em] text-accent">Manually Add Manuscript to Library</p>
      <p className="text-muted-foreground">
        Use this for papers that weren't submitted through the on-site form (e.g. legacy issues,
        direct emails).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Title *
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Author(s) *
          </span>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            required
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Issue
          </span>
          <input
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Vol. I · Issue 1"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Topic
          </span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Author email
          </span>
          <input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">DOI</span>
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.xxxx/xxxxxx"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            ORCID(s) — comma or space separated
          </span>
          <input
            value={orcids}
            onChange={(e) => setOrcids(e.target.value)}
            placeholder="0000-0002-1825-0097, 0000-0001-2345-6789"
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Keywords — comma separated
          </span>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Manuscript file (PDF or Word) *
          </span>
          <input
            key={fileKey}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="mt-1 w-full border border-border bg-background px-2 py-1.5"
          />
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setFileKey((k) => k + 1);
              }}
              className="mt-1 text-[10px] uppercase tracking-[0.18em] text-destructive hover:underline"
            >
              Remove file
            </button>
          )}
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={awardWinner}
          onChange={(e) => setAwardWinner(e.target.checked)}
        />
        <span>🏆 Mark as Award Winner</span>
      </label>
      {awardWinner && (
        <input
          value={awardLabel}
          onChange={(e) => setAwardLabel(e.target.value)}
          placeholder="Award label (optional)"
          className="w-full border border-border bg-background px-2 py-1.5"
        />
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        <span>⭐ Feature on home page</span>
      </label>
      {err && <p className="text-destructive">{err}</p>}
      {msg && <p className="text-accent">{msg}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-primary text-primary-foreground uppercase tracking-[0.18em] hover:bg-accent disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Add to Library"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 border border-border uppercase tracking-[0.18em] hover:bg-muted"
        >
          Close
        </button>
      </div>
    </form>
  );
}
