import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { getLibrary, updateEntry, type LibraryEntry } from "@/lib/library";
import { getSession, isStaff, onAuthChange, type Session } from "@/lib/auth";
import { generateArticleCitations } from "@/lib/citation-generator.functions";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Library — Published Student Research | NYRJ" },
      {
        name: "description",
        content:
          "Browse every peer-reviewed manuscript published in the National Youth Research Journal — original student research across every academic discipline.",
      },
      {
        name: "keywords",
        content:
          "NYRJ library, published student research, youth research archive, peer reviewed student papers, open access student manuscripts",
      },
      { property: "og:title", content: "Library — Published Student Research | NYRJ" },
      {
        property: "og:description",
        content: "Every peer-reviewed manuscript published in the National Youth Research Journal.",
      },
      { property: "og:url", content: "https://nyrj.org/archive" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/archive" }],
  }),
  component: Library,
});

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function CopyCitationButton({ entry }: { entry: LibraryEntry }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [citation, setCitation] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const bundle = await generateArticleCitations({ data: { id: entry.id } });
            setCitation(bundle.apa);
            try {
              await navigator.clipboard.writeText(bundle.apa);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setError("Select the citation below to copy it.");
            }
          } catch {
            setError("Could not generate the citation.");
          } finally {
            setBusy(false);
          }
        }}
        className="shrink-0 px-3 py-1.5 border border-border text-[10px] uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50"
        title="Generate and copy APA citation"
      >
        {busy ? "Generating…" : copied ? "Copied ✓" : "Generate citation"}
      </button>
      <Link
        to="/article/$slug"
        params={{ slug: entry.slug }}
        hash="cite-this-article"
        className="text-[10px] text-accent underline"
      >
        All citation formats
      </Link>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
      {citation && (
        <p className="max-w-xs select-text text-right text-xs text-foreground">{citation}</p>
      )}
    </div>
  );
}

function Library() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [topic, setTopic] = useState("all");
  const [grade, setGrade] = useState("all");

  useEffect(() => {
    getLibrary()
      .then(setEntries)
      .catch((error: unknown) => {
        console.error("library load failed:", error);
        setLoadError(
          error instanceof Error ? error.message : "The manuscript library could not be loaded.",
        );
      })
      .finally(() => setReady(true));
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  const staff = isStaff(session);

  const years = useMemo(() => {
    const s = new Set<number>();
    entries.forEach((e) => s.add(new Date(e.addedAt).getFullYear()));
    return Array.from(s).sort((a, b) => b - a);
  }, [entries]);

  const topics = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => {
      if (e.topic) s.add(e.topic);
    });
    return Array.from(s).sort();
  }, [entries]);

  const grades = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => {
      if (e.grade) s.add(e.grade);
    });
    return Array.from(s).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (qq) {
        const hay =
          `${e.title} ${e.authors} ${e.issue ?? ""} ${e.topic ?? ""} ${e.grade ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      const d = new Date(e.addedAt);
      if (year !== "all" && d.getFullYear() !== Number(year)) return false;
      if (month !== "all" && d.getMonth() !== Number(month)) return false;
      if (topic !== "all" && (e.topic ?? "") !== topic) return false;
      if (grade !== "all" && (e.grade ?? "") !== grade) return false;
      return true;
    });
  }, [entries, q, year, month, topic, grade]);

  const anyFilter =
    q !== "" || year !== "all" || month !== "all" || topic !== "all" || grade !== "all";

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Published Manuscripts</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3">Library</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          The complete public record of every manuscript published in the National Youth Research
          Journal can be accessed through our webite. Tap any title to open the full manuscript.
        </p>

        {/* Search + Filters */}
        <div className="mt-8 border border-border bg-card p-4 space-y-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, author, topic…"
            className="w-full border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <FilterSelect
              label="Year"
              value={year}
              onChange={setYear}
              options={[
                { value: "all", label: "All years" },
                ...years.map((y) => ({ value: String(y), label: String(y) })),
              ]}
            />
            <FilterSelect
              label="Month"
              value={month}
              onChange={setMonth}
              options={[
                { value: "all", label: "All months" },
                ...MONTHS.map((m, i) => ({ value: String(i), label: m })),
              ]}
            />
            <FilterSelect
              label="Topic"
              value={topic}
              onChange={setTopic}
              options={[
                { value: "all", label: "All topics" },
                ...topics.map((t) => ({ value: t, label: t })),
              ]}
            />
            <FilterSelect
              label="Grade"
              value={grade}
              onChange={setGrade}
              options={[
                { value: "all", label: "All grades" },
                ...grades.map((g) => ({ value: g, label: g })),
              ]}
            />
          </div>
          {anyFilter && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {filtered.length} of {entries.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setYear("all");
                  setMonth("all");
                  setTopic("all");
                  setGrade("all");
                }}
                className="text-accent hover:text-primary underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {ready && loadError ? (
          <div className="mt-12 border-l-4 border-destructive bg-destructive/10 px-6 py-5">
            <p className="font-serif text-2xl text-primary">The library could not be loaded.</p>
            <p className="mt-2 text-sm text-destructive">{loadError}</p>
          </div>
        ) : ready && entries.length === 0 ? (
          <div className="mt-12 border-2 border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="font-serif text-2xl text-primary">No manuscripts published yet.</p>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              New articles are added on a rolling basis as soon as they clear review.
            </p>
          </div>
        ) : ready && filtered.length === 0 ? (
          <div className="mt-12 border-2 border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="font-serif text-2xl text-primary">No matches.</p>
            <p className="mt-3 text-muted-foreground">Try a different search or clear filters.</p>
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-border border-t-2 border-primary">
            {filtered.map((e) => (
              <li key={e.id} className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    to="/article/$slug"
                    params={{ slug: e.slug }}
                    className="group block flex-1"
                  >
                    <h3 className="font-serif text-2xl text-primary group-hover:text-accent transition">
                      {e.title}
                      {e.featured && (
                        <span className="ml-2 align-middle text-[9px] uppercase tracking-[0.2em] bg-accent text-accent-foreground px-2 py-0.5">
                          Featured
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-sm text-foreground/80">{e.authors}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      {e.issue ? `${e.issue} · ` : ""}
                      {new Date(e.publicationDate ?? e.addedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {e.doi ? ` · DOI: ${e.doi}` : ""}
                      {" · "}Read article →
                    </p>
                    {(e.topic || e.grade) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.topic && (
                          <span className="text-[10px] uppercase tracking-[0.2em] border border-border px-2 py-0.5 text-foreground/80">
                            {e.topic}
                          </span>
                        )}
                        {e.grade && (
                          <span className="text-[10px] uppercase tracking-[0.2em] border border-border px-2 py-0.5 text-foreground/80">
                            Grade {e.grade}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {e.awardWinner && (
                      <span
                        className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-2.5 py-1 rounded-sm shadow-sm"
                        title={e.awardLabel ?? "Award Winner"}
                      >
                        🏆 {e.awardLabel ?? "Award Winner"}
                      </span>
                    )}
                    <CopyCitationButton entry={e} />
                  </div>
                </div>
                {staff && (
                  <StaffEntryEditor
                    entry={e}
                    onSaved={async () => setEntries(await getLibrary())}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <article className="mt-12 border-t-2 border-primary pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-2xl text-primary">Open for Submissions</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">Rolling Publication</p>
          </div>
          <p className="mt-3 text-sm text-foreground/90">
            Submit your manuscript today. Accepted articles are published as soon as they clear
            review.
          </p>
          <Link
            to="/submit"
            className="inline-block mt-4 px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
          >
            Apply for Publication
          </Link>
        </article>

        {staff && (
          <p className="mt-10 text-xs text-muted-foreground">
            Staff mode: publication metadata can be edited below each manuscript.
          </p>
        )}
      </section>
    </SiteLayout>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-background px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StaffEntryEditor({
  entry,
  onSaved,
}: {
  entry: LibraryEntry;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [doi, setDoi] = useState(entry.doi ?? "");
  const [featured, setFeatured] = useState(entry.featured);
  const [awardWinner, setAwardWinner] = useState(entry.awardWinner);
  const [awardLabel, setAwardLabel] = useState(entry.awardLabel ?? "");
  const [orcids, setOrcids] = useState(entry.orcids?.join(", ") ?? "");
  const [issue, setIssue] = useState(entry.issue ?? "");
  const [publicationDate, setPublicationDate] = useState(entry.publicationDate ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const orcidList = orcids
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      await updateEntry(entry.id, {
        doi: doi.trim() || null,
        featured,
        awardWinner,
        awardLabel: awardWinner ? awardLabel.trim() || null : null,
        orcids: orcidList.length ? orcidList : null,
        issue: issue.trim() || null,
        publicationDate: publicationDate.trim() || null,
      });
      setMsg("Saved.");
      await onSaved();
      setTimeout(() => setMsg(""), 1500);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] uppercase tracking-[0.2em] text-accent hover:text-primary underline underline-offset-4"
      >
        {open ? "Close editor" : "Edit issue / date / DOI / featured / award / ORCIDs"}
      </button>
      {open && (
        <div className="mt-3 border border-border bg-card p-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
                Issue
              </label>
              <input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Vol. 2, Issue 1"
                className="w-full border border-border bg-background px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
                Publication date
              </label>
              <input
                type="date"
                value={publicationDate}
                onChange={(e) => setPublicationDate(e.target.value)}
                className="w-full border border-border bg-background px-2 py-1.5"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
              DOI
            </label>
            <input
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.xxxx/yyyy"
              className="w-full border border-border bg-background px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
              ORCIDs (comma-separated, in author order)
            </label>
            <input
              value={orcids}
              onChange={(e) => setOrcids(e.target.value)}
              placeholder="0000-0000-0000-0000, 0000-0000-0000-0001"
              className="w-full border border-border bg-background px-2 py-1.5"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            <span>Feature this paper on the home page</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={awardWinner}
              onChange={(e) => setAwardWinner(e.target.checked)}
            />
            <span>🏆 Mark as Award Winner</span>
          </label>
          {awardWinner && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
                Award label (optional)
              </label>
              <input
                value={awardLabel}
                onChange={(e) => setAwardLabel(e.target.value)}
                placeholder="Best Paper — NYRJ Fall Symposium 2025"
                className="w-full border border-border bg-background px-2 py-1.5"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
