import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  advisorCreate,
  advisorDelete,
  advisorRemovePhoto,
  advisorUpdateInfo,
  advisorUpdatePhoto,
  advisorsList,
  type AdvisorRow,
} from "@/lib/advisors.functions";
import { getSession, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";

export const Route = createFileRoute("/advisors")({
  head: () => ({
    meta: [
      { title: "Advisory Board — National Youth Research Journal" },
      { name: "description", content: "Meet the academics and professionals on the NYRJ advisory board guiding editorial standards and mentoring student researchers." },
      { name: "keywords", content: "research advisors, student research mentors, academic advisory board, faculty mentors for student research, research mentorship" },
      { property: "og:title", content: "Advisory Board — National Youth Research Journal" },
      { property: "og:description", content: "Academics and professionals guiding NYRJ's editorial standards." },
      { property: "og:url", content: "https://nyrj.org/advisors" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/advisors" }],
  }),
  component: Advisors,
});

function Advisors() {
  const [rows, setRows] = useState<AdvisorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  async function refresh() {
    try {
      setRows(await advisorsList());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load advisors.");
    }
  }

  useEffect(() => {
    setSession(getSession());
    const unsub = onAuthChange(setSession);
    refresh();
    return unsub;
  }, []);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">NYRJ ADVISORY BOARD</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          Our Advisors
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          The <em>National Youth Research Journal</em> is guided by a dedicated advisory board of educators, researchers, and professionals who help guide us through academic processes and give academic suggestions.&nbsp;
        </p>

        <div className="mt-12">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {rows === null && !error && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {rows && rows.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Advisor profiles will appear here soon.
            </p>
          )}
          {rows && rows.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-4">
              {rows.map((a) => (
                <li key={a.id} className="border border-border bg-card p-5">
                  {a.photo_url && (
                    <img
                      src={a.photo_url}
                      alt={`${a.name} portrait`}
                      className="w-20 h-20 rounded-full object-cover mb-4 border border-border"
                      loading="lazy"
                    />
                  )}
                  <p className="font-serif text-2xl text-primary">{a.name}</p>
                  {(a.title || a.affiliation) && (
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-accent">
                      {[a.title, a.affiliation].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {a.bio && (
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a.bio}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isStaff(session) && (
          <div className="mt-16 border-t-2 border-primary pt-8">
            <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Staff Only</p>
            <h3 className="font-serif text-3xl text-primary mt-2">Add an Advisor</h3>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Add a member to the NYRJ Advisory Board. New advisors appear immediately above.
            </p>
            <AdvisorManager rows={rows ?? []} onChanged={refresh} />
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

function AdvisorManager({ rows, onChanged }: { rows: AdvisorRow[]; onChanged: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [bio, setBio] = useState("");
  const [position, setPosition] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPhotoFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPhotoPreview(null);
    }
  }

  async function fileToBase64(file: File): Promise<{ base64: string; mime: string; fileName: string }> {
    // Resize/recompress to JPEG (max 800px) so payload stays small and mime is always supported.
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const MAX = 800;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = jpeg.slice(jpeg.indexOf(",") + 1);
    return { base64, mime: "image/jpeg", fileName: (file.name.replace(/\.[^.]+$/, "") || "photo") + ".jpg" };
  }


  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true); setError(null); setDone(null);
    try {
      let photoData: { photoBase64: string; photoMime: string; photoFileName: string } | undefined;
      if (photoFile) {
        const { base64, mime, fileName } = await fileToBase64(photoFile);
        photoData = { photoBase64: base64, photoMime: mime, photoFileName: fileName };
      }
      const row = await advisorCreate({
        data: {
          staffToken: staffToken(),
          name: name.trim(),
          title: title.trim() || undefined,
          affiliation: affiliation.trim() || undefined,
          bio: bio.trim() || undefined,
          position: position.trim() ? Number(position) : undefined,
          ...photoData,
        },
      });
      setDone(`Added "${row.name}" to the Advisory Board.`);
      setName(""); setTitle(""); setAffiliation(""); setBio(""); setPosition("");
      setPhotoFile(null); setPhotoPreview(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add advisor.");
    } finally { setBusy(false); }
  }

  async function handleDelete(row: AdvisorRow) {
    if (!window.confirm(`Remove "${row.name}" from the Advisory Board?`)) return;
    try {
      await advisorDelete({ data: { staffToken: staffToken(), id: row.id } });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleUpdatePhoto(row: AdvisorRow, file: File) {
    try {
      const { base64, mime, fileName } = await fileToBase64(file);
      await advisorUpdatePhoto({
        data: { staffToken: staffToken(), id: row.id, photoBase64: base64, photoMime: mime, photoFileName: fileName },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo update failed.");
    }
  }

  async function handleRemovePhoto(row: AdvisorRow) {
    if (!window.confirm(`Remove photo for "${row.name}"?`)) return;
    try {
      await advisorRemovePhoto({ data: { staffToken: staffToken(), id: row.id } });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo removal failed.");
    }
  }

  return (
    <div className="mt-6 space-y-6 max-w-2xl">
      <form onSubmit={submit} className="border border-border bg-card p-6 space-y-4">
        <Field label="Full Name" value={name} onChange={setName} required />
        <Field label="Title (optional)" value={title} onChange={setTitle} placeholder="e.g. Professor of Biology" />
        <Field label="Affiliation (optional)" value={affiliation} onChange={setAffiliation} placeholder="e.g. Georgia Tech" />
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
            Short Bio (optional)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <Field label="Display Order (optional)" value={position} onChange={setPosition} placeholder="0 (smaller appears first)" />
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
            Photo (optional) — upload OR paste image URL
          </label>
          <label className="inline-block px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] cursor-pointer hover:bg-accent">
            Choose File
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
          {photoFile && (
            <span className="ml-3 text-xs text-muted-foreground">{photoFile.name}</span>
          )}
          <input
            type="url"
            placeholder="…or paste a direct image URL (https://…)"
            onChange={async (e) => {
              const url = e.target.value.trim();
              if (!url) { setPhotoFile(null); setPhotoPreview(null); return; }
              try {
                const res = await fetch(url);
                const blob = await res.blob();
                const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
                const f = new File([blob], `photo.${ext}`, { type: blob.type });
                setPhotoFile(f);
                const reader = new FileReader();
                reader.onload = () => setPhotoPreview(reader.result as string);
                reader.readAsDataURL(f);
              } catch {
                setError("Could not load that image URL.");
              }
            }}
            className="mt-2 w-full border border-border bg-background px-3 py-2 text-sm"
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              className="mt-3 w-20 h-20 rounded-full object-cover border border-border"
            />
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {done && <p className="text-xs text-accent">{done}</p>}
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add Advisor"}
        </button>
      </form>

      {rows.length > 0 && (
        <div className="border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">Current Advisors</p>
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  {r.photo_url ? (
                    <img src={r.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted border border-border shrink-0" />
                  )}
                  <span className="flex-1">
                    <strong>{r.name}</strong>
                    {r.title ? ` — ${r.title}` : ""}
                    {r.affiliation ? ` · ${r.affiliation}` : ""}
                  </span>
                  <EditToggle id={r.id} editingId={editingId} setEditingId={setEditingId} />
                  <PhotoActions row={r} onUpdate={handleUpdatePhoto} onRemove={handleRemovePhoto} />
                  <button type="button" onClick={() => handleDelete(r)}
                    className="px-2 py-1 border border-border text-destructive hover:bg-destructive hover:text-destructive-foreground transition">
                    ✕
                  </button>
                </div>
                {editingId === r.id && (
                  <EditAdvisorForm
                    row={r}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => { setEditingId(null); await onChanged(); }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PhotoActions({
  row,
  onUpdate,
  onRemove,
}: {
  row: AdvisorRow;
  onUpdate: (row: AdvisorRow, file: File) => void;
  onRemove: (row: AdvisorRow) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpdate(row, f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="px-2 py-1 border border-border text-xs hover:bg-accent hover:text-accent-foreground transition"
        title="Change photo"
        aria-label="Change advisor photo"
      >
        <span aria-hidden="true">📷</span>
      </button>
      {row.photo_url && (
        <button
          type="button"
          onClick={() => onRemove(row)}
          className="px-2 py-1 border border-border text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground transition"
          title="Remove photo"
          aria-label="Remove advisor photo"
        >
          <span aria-hidden="true">🗑</span>
        </button>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function EditToggle({
  id, editingId, setEditingId,
}: { id: string; editingId: string | null; setEditingId: (v: string | null) => void }) {
  const active = editingId === id;
  return (
    <button
      type="button"
      onClick={() => setEditingId(active ? null : id)}
      className={`px-2 py-1 border border-border text-xs transition ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}
      title={active ? "Cancel edit" : "Edit info"}
      aria-label={active ? "Cancel editing advisor" : "Edit advisor info"}
      aria-pressed={active}
    >
      <span aria-hidden="true">✎</span>
    </button>
  );
}

function EditAdvisorForm({
  row, onCancel, onSaved,
}: { row: AdvisorRow; onCancel: () => void; onSaved: () => void | Promise<void> }) {
  const [name, setName] = useState(row.name);
  const [title, setTitle] = useState(row.title ?? "");
  const [affiliation, setAffiliation] = useState(row.affiliation ?? "");
  const [bio, setBio] = useState(row.bio ?? "");
  const [position, setPosition] = useState(String(row.position ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      await advisorUpdateInfo({
        data: {
          staffToken: staffToken(),
          id: row.id,
          name: name.trim(),
          title: title.trim() || undefined,
          affiliation: affiliation.trim() || undefined,
          bio: bio.trim() || undefined,
          position: position.trim() ? Number(position) : undefined,
        },
      });
      await onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Update failed.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="ml-13 border border-border bg-background p-4 space-y-3">
      <Field label="Full Name" value={name} onChange={setName} required />
      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Affiliation" value={affiliation} onChange={setAffiliation} />
      <div>
        <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">Short Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <Field label="Display Order" value={position} onChange={setPosition} />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50">
          {busy ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-border text-xs uppercase tracking-[0.2em] hover:bg-muted transition">
          Cancel
        </button>
      </div>
    </form>
  );
}
