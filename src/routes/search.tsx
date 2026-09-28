import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { siteSearch, type SearchHit } from "@/lib/search.functions";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Search — NYRJ" },
      { name: "description", content: "Search articles, advisors, events, and team across NYRJ." },
      {
        name: "keywords",
        content:
          "search student research, find research papers by students, student journal search, research paper database students",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SearchPage,
});

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  article: "Article",
  advisor: "Advisor",
  event: "Event",
  team: "Editorial Team",
};

function SearchPage() {
  const navigate = useNavigate({ from: "/search" });
  const { q } = useSearch({ from: "/search" });
  const [input, setInput] = useState(q ?? "");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInput(q ?? "");
    if (!q || !q.trim()) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    siteSearch({ data: { q: q.trim() } })
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    void navigate({ search: { q: trimmed } });
  }

  const grouped: Partial<Record<SearchHit["kind"], SearchHit[]>> = {};
  for (const r of results ?? []) {
    (grouped[r.kind] ??= []).push(r);
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Search</p>
        <h2 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Search NYRJ
        </h2>
        <p className="mt-3 text-muted-foreground">
          Find articles, advisors, events, and editorial team across the site.
        </p>

        <form onSubmit={submit} className="mt-8 flex gap-2">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search articles, people, events…"
            className="flex-1 border border-border bg-background px-4 py-3 text-sm"
            autoFocus
          />
          <button
            type="submit"
            className="px-5 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
          >
            Search
          </button>
        </form>

        {loading && <p className="mt-8 text-sm text-muted-foreground">Searching…</p>}
        {error && <p className="mt-8 text-sm text-destructive">{error}</p>}

        {results && !loading && results.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            No matches for <em>{q}</em>.
          </p>
        )}

        {results && results.length > 0 && (
          <div className="mt-10 space-y-10">
            {(Object.keys(grouped) as SearchHit["kind"][]).map((kind) => (
              <div key={kind}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent mb-3">
                  {KIND_LABEL[kind]}
                </p>
                <div className="space-y-3">
                  {grouped[kind]!.map((hit) => (
                    <Link
                      key={`${hit.kind}-${hit.id}`}
                      to={hit.href}
                      className="block border border-border bg-card p-4 hover:border-primary transition"
                    >
                      <p className="font-serif text-lg text-primary">{hit.title}</p>
                      {hit.subtitle && (
                        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1">
                          {hit.subtitle}
                        </p>
                      )}
                      {hit.snippet && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {hit.snippet}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
