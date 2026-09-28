import { useEffect, useState, type FormEvent } from "react";
import {
  listChaptersAdmin,
  saveChapter,
  deleteChapter,
  type Chapter,
} from "@/lib/ambassadors.functions";

type Auth = { password?: string; staffToken?: string };

const EMPTY_FORM = {
  id: undefined as string | undefined,
  chapter_number: "",
  school_name: "",
  location: "",
  chapter_lead: "",
  chapter_lead_email: "",
  chapter_lead_2: "",
  chapter_lead_2_email: "",
  about: "",
  new_students_this_year: "0",
  notes: "",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function ChapterEditor({ auth, getAuth }: { auth?: Auth; getAuth?: () => Auth }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoKey, setPhotoKey] = useState(0);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const credentials = () => (getAuth ? getAuth() : (auth ?? {}));

  async function refresh() {
    try {
      setChapters(await listChaptersAdmin({ data: credentials() }));
    } catch {
      setChapters([]);
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function edit(c: Chapter) {
    setForm({
      id: c.id,
      chapter_number: String(c.chapter_number),
      school_name: c.school_name,
      location: c.location ?? "",
      chapter_lead: c.chapter_lead ?? "",
      chapter_lead_email: c.chapter_lead_email ?? "",
      chapter_lead_2: c.chapter_lead_2 ?? "",
      chapter_lead_2_email: c.chapter_lead_2_email ?? "",
      about: c.about ?? "",
      new_students_this_year: String(c.new_students_this_year),
      notes: c.notes ?? "",
    });
    setPhoto(null);
    setRemovePhoto(false);
    setPhotoKey((k) => k + 1);
    setMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setForm({ ...EMPTY_FORM });
    setPhoto(null);
    setRemovePhoto(false);
    setPhotoKey((k) => k + 1);
    setMsg(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const photoFields = photo
        ? {
            photoBase64: await fileToBase64(photo),
            photoMime: photo.type,
            photoFileName: photo.name,
          }
        : {};
      await saveChapter({
        data: {
          ...credentials(),
          id: form.id,
          chapter_number: Math.floor(Number(form.chapter_number) || 0),
          school_name: form.school_name.trim(),
          location: form.location.trim(),
          chapter_lead: form.chapter_lead.trim(),
          chapter_lead_email: form.chapter_lead_email.trim(),
          chapter_lead_2: form.chapter_lead_2.trim() || null,
          chapter_lead_2_email: form.chapter_lead_2_email.trim() || null,
          about: form.about.trim(),
          new_students_this_year: Math.max(0, Math.floor(Number(form.new_students_this_year) || 0)),
          notes: form.notes.trim() || null,
          removePhoto,
          ...photoFields,
        },
      });
      reset();
      await refresh();
      setMsg("Chapter saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this chapter?")) return;
    try {
      await deleteChapter({ data: { ...credentials(), id } });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="mt-4 border border-border bg-card p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Chapter Number"
            type="number"
            required
            value={form.chapter_number}
            onChange={(v) => setForm({ ...form, chapter_number: v })}
          />
          <Field
            label="School Name"
            required
            value={form.school_name}
            onChange={(v) => setForm({ ...form, school_name: v })}
          />
          <Field
            label="Location (City, State/Country)"
            required
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
          />
          <Field
            label="Chapter Lead"
            required
            value={form.chapter_lead}
            onChange={(v) => setForm({ ...form, chapter_lead: v })}
          />
          <Field
            label="Chapter Lead Email"
            type="email"
            required
            value={form.chapter_lead_email}
            onChange={(v) => setForm({ ...form, chapter_lead_email: v })}
          />
          <Field
            label="Second Chapter Lead (optional)"
            value={form.chapter_lead_2}
            onChange={(v) => setForm({ ...form, chapter_lead_2: v })}
          />
          <Field
            label="Second Chapter Lead Email (optional)"
            type="email"
            value={form.chapter_lead_2_email}
            onChange={(v) => setForm({ ...form, chapter_lead_2_email: v })}
          />
          <Field
            label="New Students This Year"
            type="number"
            required
            value={form.new_students_this_year}
            onChange={(v) => setForm({ ...form, new_students_this_year: v })}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
            About this chapter (required)
          </label>
          <textarea
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            rows={4}
            required
            minLength={20}
            className="w-full border border-border bg-background px-3 py-2 text-sm"
            placeholder="What your chapter does, when you meet, what students can expect, and how to get involved. (At least a couple of sentences.)"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
            Chapter Lead Photo
          </label>
          <input
            key={photoKey}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              setPhoto(e.target.files?.[0] ?? null);
              setRemovePhoto(false);
            }}
            className="text-sm"
          />
          {photo && (
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                setPhotoKey((k) => k + 1);
              }}
              className="ml-3 text-xs text-muted-foreground hover:text-destructive underline"
            >
              remove
            </button>
          )}
          {form.id && !photo && (
            <label className="ml-4 text-xs text-muted-foreground inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={removePhoto}
                onChange={(e) => setRemovePhoto(e.target.checked)}
              />
              Delete existing photo
            </label>
          )}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
            Additional Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full border border-border bg-background px-3 py-2 text-sm"
            placeholder="Anything else you'd like the journal to know."
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={busy}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
          >
            {busy ? "Saving…" : form.id ? "Update Chapter" : "Register Chapter"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
            >
              Cancel edit
            </button>
          )}
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </form>

      <h3 className="font-serif text-xl text-primary mt-8">Existing Chapters</h3>
      {chapters.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No chapters registered yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {chapters.map((c) => (
            <li
              key={c.id}
              className="border border-border bg-card p-4 flex items-start justify-between gap-4"
            >
              <div className="flex gap-3">
                {c.lead_photo_url && (
                  <img
                    src={c.lead_photo_url}
                    alt={`${c.chapter_lead ?? "Chapter lead"} portrait`}
                    className="w-12 h-12 object-cover rounded-full border border-border"
                    loading="lazy"
                  />
                )}
                <div className="text-sm">
                  <p className="font-semibold">
                    Chapter {c.chapter_number} — {c.school_name}
                    {c.location && <span className="text-muted-foreground"> · {c.location}</span>}
                  </p>
                  {c.chapter_lead && (
                    <p className="text-muted-foreground">
                      Lead: {c.chapter_lead}
                      {c.chapter_lead_email && <> · {c.chapter_lead_email}</>}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    New students this year: {c.new_students_this_year}
                  </p>
                  {c.notes && <p className="italic text-muted-foreground mt-1">{c.notes}</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => edit(c)}
                  title="Edit"
                  className="text-xs px-2 py-1 border border-border hover:border-accent hover:text-accent"
                >
                  ✎
                </button>
                <button
                  onClick={() => remove(c.id)}
                  title="Delete"
                  className="text-xs px-2 py-1 border border-border hover:border-destructive hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
