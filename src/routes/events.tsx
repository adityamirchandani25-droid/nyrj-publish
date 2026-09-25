import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  eventCreate,
  eventDelete,
  eventExtractFromPoster,
  eventIdeaSubmit,
  eventsList,
  type EventRow,
} from "@/lib/events.functions";
import { getSession, isResearcher, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";
import { getEventAttendance, setEventAttendance } from "@/lib/ambassadors.functions";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Special Events — NYRJ" },
      { name: "description", content: "Past, current, and upcoming events from the National Youth Research Journal. Recommend your own." },
      { name: "keywords", content: "student research events, research conferences for students, youth science symposium, student research competitions, academic events for high school students" },
      { property: "og:title", content: "Special Events — NYRJ" },
      { property: "og:description", content: "Past, current, and upcoming events from NYRJ." },
    ],
  }),
  component: EventsPage,
});

type Bucket = "current" | "upcoming" | "past";

function bucketize(events: EventRow[]): Record<Bucket, EventRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Record<Bucket, EventRow[]> = { current: [], upcoming: [], past: [] };
  for (const e of events) {
    if (!e.event_date) { out.upcoming.push(e); continue; }
    const d = new Date(e.event_date + "T00:00:00");
    const diff = (d.getTime() - today.getTime()) / 86_400_000;
    if (Math.abs(diff) < 1) out.current.push(e);
    else if (diff > 0) out.upcoming.push(e);
    else out.past.push(e);
  }
  out.past.sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""));
  return out;
}

function EventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  async function refresh() {
    try { setEvents(await eventsList()); } catch { setEvents([]); }
  }

  useEffect(() => {
    setSession(getSession());
    const unsub = onAuthChange(setSession);
    refresh();
    return unsub;
  }, []);

  const buckets = useMemo(() => bucketize(events ?? []), [events]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Special Events</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          NYRJ Events
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          Talks, workshops, conferences, panels, and meetups for student researchers. Have an
          idea? Recommend one below.
        </p>

        {events === null && <p className="mt-10 text-sm text-muted-foreground">Loading events…</p>}

        {events !== null && (
          <>
            <EventGroup title="Happening Now" items={buckets.current} empty="No events today." />
            <EventGroup title="Upcoming" items={buckets.upcoming} empty="No upcoming events yet, check back soon." />
            <EventGroup title="Past Events" items={buckets.past} empty="No past events archived yet." />
          </>
        )}

        <div className="mt-16 border-t-2 border-primary pt-8">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Student Perspective</p>
          <h3 className="font-serif text-3xl text-primary mt-2">Recommend an Event</h3>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Got an idea for a talk, workshop, or meetup you'd love to see NYRJ host? Email us for a chance see your idea happen!
          </p>
          {isResearcher(session) ? (
            <IdeaForm studentEmail={session!.username} />
          ) : (
            <div className="mt-6 border border-border bg-card p-6 max-w-2xl">
              <p className="text-sm text-foreground/90">
                Please <a href="/login" className="text-primary underline underline-offset-4">log in as a student</a> to recommend an event. This helps us follow up with you about your idea.
              </p>
            </div>
          )}
        </div>

        {isStaff(session) && (
          <div className="mt-16 border-t-2 border-primary pt-8">
            <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Staff Only</p>
            <h3 className="font-serif text-3xl text-primary mt-2">Add a Special Event</h3>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Upload an event poster — AI reads it and fills in the title, date, location, and
              description. Confirm and publish; the event appears above, automatically sorted into
              past, current, or upcoming.
            </p>
            <EventManager events={events ?? []} onChanged={refresh} />

            <h3 className="font-serif text-3xl text-primary mt-12">Event Metrics</h3>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Staff-only. Total attendance across all NYRJ events. Whatever number you enter here is
              added to the public <strong>Students impacted</strong> metric.
            </p>
            <EventMetricsPanel />
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

function EventMetricsPanel() {
  const [value, setValue] = useState<number>(0);
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void getEventAttendance().then((n) => { setValue(n); setDraft(String(n)); });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const n = Math.max(0, Math.floor(Number(draft) || 0));
      const res = await setEventAttendance({ data: { staffToken: staffToken(), value: n } });
      setValue(res.value);
      setMsg("Saved — Students impacted updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="mt-5 border border-border bg-card p-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Current total event attendance:{" "}
        <span className="text-accent font-semibold">{value.toLocaleString()}</span>
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
            Total event attendance
          </label>
          <input type="number" min={0} value={draft} onChange={(e) => setDraft(e.target.value)}
            className="border border-border bg-background px-3 py-2 text-sm w-40" />
        </div>
        <button disabled={busy}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50">
          {busy ? "Saving…" : "Update"}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}

function EventGroup({ title, items, empty }: { title: string; items: EventRow[]; empty: string }) {
  return (
    <div className="mt-10">
      <h3 className="font-serif text-2xl text-primary border-b border-border pb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground italic">{empty}</p>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {items.map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
}

function EventCard({ e }: { e: EventRow }) {
  return (
    <article className="border border-border bg-card overflow-hidden">
      {e.poster_url && (
        <img src={e.poster_url} alt={e.title} className="w-full h-48 object-cover" loading="lazy" />
      )}
      <div className="p-4">
        <h4 className="font-serif text-lg text-primary">{e.title}</h4>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-accent">
          {e.event_date ? new Date(e.event_date + "T00:00:00").toLocaleDateString(undefined, {
            year: "numeric", month: "long", day: "numeric",
          }) : "Date TBA"}
          {e.location ? ` · ${e.location}` : ""}
        </p>
        {e.description && <p className="mt-2 text-sm text-foreground/90 whitespace-pre-line">{e.description}</p>}
      </div>
    </article>
  );
}

function IdeaForm({ studentEmail }: { studentEmail: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setDone(null);
    try {
      await eventIdeaSubmit({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
        },
      });
      const subject = encodeURIComponent(`Event Idea: ${title.trim()}`);
      const body = encodeURIComponent(
        `From: ${studentEmail}\n\nEvent Idea: ${title.trim()}\n\n${description.trim() || "(no extra details)"}\n\n— Sent from NYRJ Events page`
      );
      window.location.href = `mailto:NYRJINFO@gmail.com?subject=${subject}&body=${body}`;
      setDone("Thanks! Your idea was saved and your email app should open so you can send it to NYRJINFO@gmail.com.");
      setTitle(""); setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-6 border border-border bg-card p-6 space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Your Email</label>
        <p className="text-sm text-foreground/90 border border-border bg-background px-3 py-2">{studentEmail}</p>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Event Idea</label>
        <input type="text" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-border bg-background px-3 py-2 text-sm"
          placeholder="e.g. Panel on undergraduate research publishing" />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Tell us more (optional)</label>
        <textarea rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-border bg-background px-3 py-2 text-sm"
          placeholder="What would make this great? Speakers, format, audience…" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {done && <p className="text-xs text-accent">{done}</p>}
      <button disabled={busy}
        className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50">
        {busy ? "Sending…" : "Send Idea"}
      </button>
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function EventManager({ events, onChanged }: { events: EventRow[]; onChanged: () => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [posterB64, setPosterB64] = useState<string | null>(null);
  const [posterMime, setPosterMime] = useState<string | null>(null);
  const [posterFileName, setPosterFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    if (!f) { setPosterB64(null); setPosterMime(null); setPosterFileName(null); return; }
    if (!/^image\//.test(f.type)) { setError("Please pick an image (PNG, JPEG, WebP, GIF)."); return; }
    setExtracting(true);
    try {
      const b64 = await fileToBase64(f);
      setPosterB64(b64);
      setPosterMime(f.type);
      setPosterFileName(f.name);
      const out = await eventExtractFromPoster({
        data: { staffToken: staffToken(), imageBase64: b64, mimeType: f.type },
      });
      if (out.title) setTitle(out.title);
      if (out.description) setDescription(out.description);
      if (out.location) setLocation(out.location);
      if (out.event_date) setEventDate(out.event_date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setBusy(true); setError(null); setDone(null);
    try {
      await eventCreate({
        data: {
          staffToken: staffToken(),
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          eventDate: eventDate || null,
          posterBase64: posterB64 ?? undefined,
          posterMime: posterMime ?? undefined,
          posterFileName: posterFileName ?? undefined,
        },
      });
      setDone(`Published "${title.trim()}".`);
      setTitle(""); setDescription(""); setLocation(""); setEventDate("");
      setFile(null); setPosterB64(null); setPosterMime(null); setPosterFileName(null);
      const input = document.getElementById("event-poster") as HTMLInputElement | null;
      if (input) input.value = "";
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally { setBusy(false); }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Remove "${title}" from Events?`)) return;
    try {
      await eventDelete({ data: { staffToken: staffToken(), id } });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="mt-6 space-y-6 max-w-2xl">
      <form onSubmit={submit} className="border border-border bg-card p-6 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
            Event Poster (AI fills the fields below)
          </label>
          <input
            id="event-poster"
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          {extracting && <p className="mt-1 text-xs text-muted-foreground">Reading poster with AI…</p>}
          {file && !extracting && <p className="mt-1 text-xs text-accent">Extracted — edit anything below before publishing.</p>}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Event Title</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Date</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Description</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {done && <p className="text-xs text-accent">{done}</p>}
        <button disabled={busy || extracting}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50">
          {busy ? "Publishing…" : "Publish Event"}
        </button>
      </form>

      {events.length > 0 && (
        <div className="border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">Current Events</p>
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="flex-1">
                  {e.event_date ?? "TBA"} — <strong>{e.title}</strong>
                  {e.location ? ` · ${e.location}` : ""}
                </span>
                <button type="button" onClick={() => remove(e.id, e.title)}
                  aria-label={`Remove event ${e.title}`}
                  className="px-2 py-1 border border-border text-destructive hover:bg-destructive hover:text-destructive-foreground transition">
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
