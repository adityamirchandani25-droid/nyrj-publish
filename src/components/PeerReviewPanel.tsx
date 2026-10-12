import { useEffect, useState, type FormEvent } from "react";
import { getSession, staffToken } from "@/lib/auth";
import { VersionHistory } from "@/components/VersionHistory";
import {
  assignReviewer,
  listAssignments,
  listAuditLog,
  listReviewEmailReplies,
  openReviewEmailAttachment,
  openReviewFileForStaff,
  recordReviewerEmailDecision,
  resendReviewerInvitation,
  sendEditsToAuthor,
  markEmailReplyAsReview,
  type AssignmentRow,
  type AuditRow,
  type ReviewEmailReply,
} from "@/lib/peer-review.functions";

const heading = "text-[10px] uppercase tracking-[0.18em] text-accent";
const btn =
  "px-3 py-1.5 bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.18em] hover:bg-accent disabled:opacity-50";
const btnGhost =
  "px-3 py-1.5 border border-border text-[11px] uppercase tracking-[0.18em] hover:bg-muted disabled:opacity-50";
const field = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm";

function statusLabel(s: string) {
  switch (s) {
    case "invited":
      return "Invited — awaiting response";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "review_received":
      return "Edits received";
    case "sent_to_author":
      return "Edits sent to author";
    case "no_response":
      return "No response — 15-day deadline passed";
    default:
      return s;
  }
}

export function PeerReviewPanel({ submissionId }: { submissionId: string }) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [emailReplies, setEmailReplies] = useState<ReviewEmailReply[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [includeFile, setIncludeFile] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [versionsRefreshKey, setVersionsRefreshKey] = useState(0);

  async function load() {
    setError(null);
    try {
      const [all, log] = await Promise.all([
        listAssignments({ data: { staffToken: staffToken() } }),
        listAuditLog({ data: { staffToken: staffToken(), submissionId } }),
      ]);
      setRows(all.filter((a) => a.submission_id === submissionId));
      setAudit(log);
      try {
        const replies = await listReviewEmailReplies({
          data: { staffToken: staffToken(), submissionId },
        });
        setEmailReplies(replies);
      } catch (replyError) {
        setError(
          replyError instanceof Error
            ? replyError.message
            : "Could not load reviewer email replies.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load review data.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await assignReviewer({
        data: {
          staffToken: staffToken(),
          submissionId,
          reviewerEmail: email.trim(),
          reviewerName: name.trim(),
          assignedBy: getSession()?.username ?? "staff",
        },
      });
      setEmail("");
      setName("");
      setNote(
        result.emailSent
          ? "Secure invitation sent. The reviewer must sign in with an approved account and has 15 days from today."
          : "The assignment was created, but its invitation email failed. Check SendGrid, then use Resend secure invitation.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function send(a: AssignmentRow) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await sendEditsToAuthor({
        data: {
          staffToken: staffToken(),
          assignmentId: a.id,
          body: draft,
          includeFile,
          sentBy: getSession()?.username ?? "staff",
        },
      });
      setEditFor(null);
      setNote(
        includeFile
          ? "Comments and reviewer file shared with the author."
          : "Comments emailed to the author.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the edits.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t border-border space-y-6">
      <button
        type="button"
        className={btnGhost}
        onClick={() => {
          void load();
          setVersionsRefreshKey((key) => key + 1);
        }}
      >
        Refresh peer review and revisions
      </button>
      <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <p className={heading}>Reviewer email</p>
          <input
            className={field}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reviewer@university.edu"
          />
        </div>
        <div>
          <p className={heading}>Reviewer name (optional)</p>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Rao"
          />
        </div>
        <button className={`${btn} h-9`} disabled={busy}>
          Assign & invite
        </button>
      </form>

      {note && <p className="text-xs text-accent">{note}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div>
        <p className={heading}>Reviewers on this paper</p>
        {rows === null && <p className="mt-2 text-xs text-muted-foreground">Loading…</p>}
        {rows?.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground italic">No reviewer assigned yet.</p>
        )}
        <div className="mt-2 space-y-3">
          {(rows ?? []).map((a) => (
            <div key={a.id} className="border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-primary">
                  {a.reviewer_name || a.reviewer_email}{" "}
                  <span className="text-muted-foreground">({a.reviewer_email})</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                  {statusLabel(a.status)}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Assigned {new Date(a.assigned_at).toLocaleDateString()} · Due{" "}
                {new Date(a.due_at).toLocaleDateString()}
                {a.assigned_by ? ` · by ${a.assigned_by}` : ""}
              </p>
              {!["declined", "no_response"].includes(a.status) && (
                <button
                  className={`${btnGhost} mt-2`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    setNote(null);
                    try {
                      await resendReviewerInvitation({
                        data: { staffToken: staffToken(), assignmentId: a.id },
                      });
                      setNote(`Secure invitation resent to ${a.reviewer_email}.`);
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not resend invitation.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resend secure invitation
                </button>
              )}

              {a.review_comments && (
                <div className="mt-3">
                  <p className={heading}>Edits received</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {a.review_comments}
                  </p>
                  {a.review_file_name && (
                    <button
                      className={`${btnGhost} mt-3`}
                      onClick={async () => {
                        try {
                          const { url } = await openReviewFileForStaff({
                            data: { staffToken: staffToken(), assignmentId: a.id },
                          });
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not open the reviewer file.",
                          );
                        }
                      }}
                    >
                      Review attached file: {a.review_file_name}
                    </button>
                  )}
                  {editFor === a.id ? (
                    <div className="mt-3">
                      <p className={heading}>Review before sending to the author</p>
                      <textarea
                        className={`${field} min-h-[180px]`}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={20000}
                      />
                      {a.review_file_name && (
                        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={includeFile}
                            onChange={(e) => setIncludeFile(e.target.checked)}
                          />
                          Share the reviewed file with the author
                        </label>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          className={btn}
                          disabled={busy || !draft.trim()}
                          onClick={() => void send(a)}
                        >
                          Send edits to author
                        </button>
                        <button className={btnGhost} onClick={() => setEditFor(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className={`${btn} mt-3`}
                      onClick={() => {
                        setDraft(a.edits_sent_body || a.review_comments);
                        setIncludeFile(Boolean(a.edits_sent_file_path));
                        setEditFor(a.id);
                      }}
                    >
                      {a.edits_sent_at ? "Resend edits to author" : "Send edits to author"}
                    </button>
                  )}
                  {a.edits_sent_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last sent {new Date(a.edits_sent_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className={heading}>Reviewer email replies</p>
        {emailReplies.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground italic">
            No matched mailbox replies yet.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {emailReplies.map((reply) => (
              <div key={reply.id} className="border border-border p-3">
                <p className="text-sm text-primary">{reply.subject || "(No subject)"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reply.from_email} · {new Date(reply.received_at).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {reply.body_text}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reply.attachments.map((attachment) => (
                    <button
                      key={attachment.path}
                      type="button"
                      className={btnGhost}
                      onClick={async () => {
                        try {
                          const { url } = await openReviewEmailAttachment({
                            data: {
                              staffToken: staffToken(),
                              replyId: reply.id,
                              path: attachment.path,
                            },
                          });
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "Could not open the attachment.",
                          );
                        }
                      }}
                    >
                      Open {attachment.name}
                    </button>
                  ))}
                </div>
                {rows?.find((assignment) => assignment.id === reply.assignment_id)?.status ===
                  "invited" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["accepted", "declined"] as const).map((decision) => (
                      <button
                        key={decision}
                        type="button"
                        className={btnGhost}
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await recordReviewerEmailDecision({
                              data: { staffToken: staffToken(), replyId: reply.id, decision },
                            });
                            setNote(`Reviewer marked ${decision} from their email reply.`);
                            await load();
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Could not record the reply.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Mark {decision}
                      </button>
                    ))}
                  </div>
                )}
                {(reply.body_text.trim() || reply.attachments.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reply.body_text.trim() && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await markEmailReplyAsReview({
                              data: { staffToken: staffToken(), replyId: reply.id },
                            });
                            setNote(
                              "Email text saved as reviewer feedback. Check it before sending edits to the author.",
                            );
                            await load();
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Could not save reviewer feedback.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Use email text as reviewer feedback
                      </button>
                    )}
                    {reply.attachments.map((attachment) => (
                      <button
                        key={attachment.path}
                        type="button"
                        className={btnGhost}
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await markEmailReplyAsReview({
                              data: {
                                staffToken: staffToken(),
                                replyId: reply.id,
                                attachmentPath: attachment.path,
                              },
                            });
                            setNote(
                              "Selected email file saved as reviewer feedback. Check it before sending edits to the author.",
                            );
                            await load();
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Could not save reviewer feedback.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Use with {attachment.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className={heading}>Author revisions</p>
        <VersionHistory key={versionsRefreshKey} submissionId={submissionId} />
      </div>

      <div>
        <p className={heading}>History for this paper</p>
        {audit.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground italic">Nothing yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {audit.map((l) => (
              <li key={l.id} className="text-xs text-muted-foreground">
                <span className="text-primary">{l.action}</span>
                {l.detail ? ` — ${l.detail}` : ""} · {l.actor} ·{" "}
                {new Date(l.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
