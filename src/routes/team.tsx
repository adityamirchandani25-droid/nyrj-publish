import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { getSession, isStaff, onAuthChange, staffToken, type Session } from "@/lib/auth";
import {
  editorsList,
  editorTeamCreate,
  editorTeamDelete,
  editorTeamUpdate,
  type EditorRow,
} from "@/lib/editor-team.functions";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "The NYRJ Team — Editors, Reviewers & Staff" },
      {
        name: "description",
        content:
          "Meet the NYRJ Team — the students leading peer review, section editing, and copy editing at the National Youth Research Journal.",
      },
      { name: "keywords", content: "editorial board student journal, student journal editors, peer reviewers, youth research journal team, editorial staff" },
      { property: "og:title", content: "The NYRJ Team" },
      { property: "og:url", content: "https://nyrj.org/team" },
    ],
    links: [{ rel: "canonical", href: "https://nyrj.org/team" }],
  }),
  component: TeamPage,
});

function TeamPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [team, setTeam] = useState<EditorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setTeam(await editorsList());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">NYRJ Team</p>
        <h2 className="font-serif text-4xl sm:text-5xl text-primary mt-3 leading-tight">
          The NYRJ Team
        </h2>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          The students leading peer review, section editing, and copy editing at the National
          Youth Research Journal.
        </p>

        {loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading team…</p>
        ) : team.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            Team members will be listed here soon.
          </p>
        ) : (
          <>
            <MemberGroup
              title="Team"
              members={team.filter((m) => m.member_group !== "reviewer")}
            />
            <MemberGroup
              title="Peer Reviewers"
              members={team.filter((m) => m.member_group === "reviewer")}
            />
          </>
        )}

        {isStaff(session) && (
          <div className="mt-16 border-t-2 border-primary pt-8">
            <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Staff Only</p>
            <h3 className="font-serif text-3xl text-primary mt-2">Add a Team Member</h3>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Add a member to the NYRJ Team. New members appear immediately above.
            </p>
            <TeamManager rows={team} onChanged={refresh} />
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

function MemberGroup({ title, members }: { title: string; members: EditorRow[] }) {
  if (members.length === 0) return null;
  return (
    <div className="mt-14 first:mt-10">
      <div className="flex items-center gap-4">
        <h3 className="font-serif text-2xl text-primary whitespace-nowrap">{title}</h3>
        <span className="h-px flex-1 bg-primary/40" />
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {members.map((m) => (
          <article key={m.id} className="border border-border bg-card p-6 flex gap-4">
            {m.photo_url ? (
              <img
                src={m.photo_url}
                alt={m.name}
                loading="lazy"
                className="w-20 h-20 object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-20 h-20 border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                No photo
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-serif text-2xl text-primary">{m.name}</h4>
              {m.role && (
                <p className="text-[11px] uppercase tracking-[0.2em] text-accent mt-1">
                  {m.role}
                </p>
              )}
              {m.affiliation && (
                <p className="text-sm text-muted-foreground mt-1">{m.affiliation}</p>
              )}
              {m.email && (
                <p className="text-sm mt-2 break-all">
                  <a
                    href={`mailto:${m.email}`}
                    className="text-primary underline underline-offset-4 hover:text-accent"
                  >
                    {m.email}
                  </a>
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

async function fileToBase64(
  file: File,
): Promise<{ base64: string; mime: string; fileName: string }> {
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
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  const base64 = jpeg.slice(jpeg.indexOf(",") + 1);
  return {
    base64,
    mime: "image/jpeg",
    fileName: (file.name.replace(/\.[^.]+$/, "") || "photo") + ".jpg",
  };
}

function TeamManager({
  rows,
  onChanged,
}: {
  rows: EditorRow[];
  onChanged: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [email, setEmail] = useState("");
  const [memberGroup, setMemberGroup] = useState<"editorial" | "reviewer">("editorial");
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      let photoData:
        | { photoBase64: string; photoMime: string; photoFileName: string }
        | undefined;
      if (photoFile) {
        const { base64, mime, fileName } = await fileToBase64(photoFile);
        photoData = { photoBase64: base64, photoMime: mime, photoFileName: fileName };
      }
      const row = await editorTeamCreate({
        data: {
          staffToken: staffToken(),
          name: name.trim(),
          role: role.trim() || undefined,
          affiliation: affiliation.trim() || undefined,
          email: email.trim() || undefined,
          memberGroup,
          position: position.trim() ? Number(position) : undefined,
          ...photoData,
        },
      });
      setDone(`Added "${row.name}" to the NYRJ Team.`);
      setName("");
      setRole("");
      setAffiliation("");
      setEmail("");
      setPosition("");
      setPhotoFile(null);
      setPhotoPreview(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: EditorRow) {
    if (!window.confirm(`Remove "${row.name}" from the NYRJ Team?`)) return;
    try {
      await editorTeamDelete({ data: { staffToken: staffToken(), id: row.id } });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleUpdatePhoto(row: EditorRow, file: File) {
    try {
      const { base64, mime, fileName } = await fileToBase64(file);
      await editorTeamUpdate({
        data: {
          staffToken: staffToken(),
          id: row.id,
          name: row.name,
          role: row.role ?? undefined,
          affiliation: row.affiliation ?? undefined,
          email: row.email ?? undefined,
          memberGroup: row.member_group,
          position: row.position,
          photoBase64: base64,
          photoMime: mime,
          photoFileName: fileName,
        },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo update failed.");
    }
  }

  async function handleRemovePhoto(row: EditorRow) {
    if (!window.confirm(`Remove photo for "${row.name}"?`)) return;
    try {
      await editorTeamUpdate({
        data: {
          staffToken: staffToken(),
          id: row.id,
          name: row.name,
          role: row.role ?? undefined,
          affiliation: row.affiliation ?? undefined,
          email: row.email ?? undefined,
          memberGroup: row.member_group,
          position: row.position,
          removePhoto: true,
        },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo removal failed.");
    }
  }

  return (
    <div className="mt-6 space-y-6 max-w-2xl">
      <form onSubmit={submit} className="border border-border bg-card p-6 space-y-4">
        <Field label="Full Name" value={name} onChange={setName} required />
        <Field
          label="Role (optional)"
          value={role}
          onChange={setRole}
          placeholder="e.g. Section Editor"
        />
        <Field
          label="Affiliation (optional)"
          value={affiliation}
          onChange={setAffiliation}
          placeholder="e.g. Chattahoochee High School"
        />
        <Field
          label="Email (optional)"
          value={email}
          onChange={setEmail}
          placeholder="name@example.com"
        />
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
            Section
          </label>
          <select
            value={memberGroup}
            onChange={(e) => setMemberGroup(e.target.value as "editorial" | "reviewer")}
            className="w-full border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="editorial">Team</option>
            <option value="reviewer">Peer Reviewer</option>
          </select>
        </div>
        <Field
          label="Display Order (optional)"
          value={position}
          onChange={setPosition}
          placeholder="0 (smaller appears first)"
        />
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
              if (!url) {
                setPhotoFile(null);
                setPhotoPreview(null);
                return;
              }
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
              className="mt-3 w-20 h-20 object-cover border border-border"
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
          {busy ? "Adding…" : "Add Member"}
        </button>
      </form>

      {rows.length > 0 && (
        <div className="border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">Current Team</p>
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  {r.photo_url ? (
                    <img
                      src={r.photo_url}
                      alt=""
                      className="w-10 h-10 object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-muted border border-border shrink-0" />
                  )}
                  <span className="flex-1">
                    <strong>{r.name}</strong>
                    {r.role ? ` — ${r.role}` : ""}
                    {r.affiliation ? ` · ${r.affiliation}` : ""}
                    {r.email ? ` · ${r.email}` : ""}
                    <em className="ml-2 text-[10px] uppercase tracking-[0.2em] text-accent not-italic">
                      {r.member_group === "reviewer" ? "Peer Reviewer" : "Team"}
                    </em>
                  </span>
                  <EditToggle
                    id={r.id}
                    editingId={editingId}
                    setEditingId={setEditingId}
                  />
                  <PhotoActions
                    row={r}
                    onUpdate={handleUpdatePhoto}
                    onRemove={handleRemovePhoto}
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    className="px-2 py-1 border border-border text-destructive hover:bg-destructive hover:text-destructive-foreground transition"
                  >
                    ✕
                  </button>
                </div>
                {editingId === r.id && (
                  <EditMemberForm
                    row={r}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => {
                      setEditingId(null);
                      await onChanged();
                    }}
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
  row: EditorRow;
  onUpdate: (row: EditorRow, file: File) => void;
  onRemove: (row: EditorRow) => void;
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
      >
        📷
      </button>
      {row.photo_url && (
        <button
          type="button"
          onClick={() => onRemove(row)}
          className="px-2 py-1 border border-border text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground transition"
          title="Remove photo"
        >
          🗑
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
        {label}
      </label>
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
  id,
  editingId,
  setEditingId,
}: {
  id: string;
  editingId: string | null;
  setEditingId: (v: string | null) => void;
}) {
  const active = editingId === id;
  return (
    <button
      type="button"
      onClick={() => setEditingId(active ? null : id)}
      className={`px-2 py-1 border border-border text-xs transition ${
        active
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      }`}
      title={active ? "Cancel edit" : "Edit info"}
    >
      ✎
    </button>
  );
}

function EditMemberForm({
  row,
  onCancel,
  onSaved,
}: {
  row: EditorRow;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [role, setRole] = useState(row.role ?? "");
  const [affiliation, setAffiliation] = useState(row.affiliation ?? "");
  const [email, setEmail] = useState(row.email ?? "");
  const [memberGroup, setMemberGroup] = useState<"editorial" | "reviewer">(row.member_group);
  const [position, setPosition] = useState(String(row.position ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    const pos = position.trim() ? Number(position) : undefined;
    if (pos !== undefined && !Number.isFinite(pos)) {
      setErr("Display order must be a number.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await editorTeamUpdate({
        data: {
          staffToken: staffToken(),
          id: row.id,
          name: name.trim(),
          role: role.trim() || undefined,
          affiliation: affiliation.trim() || undefined,
          email: email.trim() || undefined,
          memberGroup,
          position: pos,
        },
      });
      await onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="ml-12 border border-border bg-background p-4 space-y-3">
      <Field label="Full Name" value={name} onChange={setName} required />
      <Field label="Role" value={role} onChange={setRole} />
      <Field label="Affiliation" value={affiliation} onChange={setAffiliation} />
      <Field label="Email" value={email} onChange={setEmail} />
      <div>
        <label className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
          Section
        </label>
        <select
          value={memberGroup}
          onChange={(e) => setMemberGroup(e.target.value as "editorial" | "reviewer")}
          className="w-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="editorial">Team</option>
          <option value="reviewer">Peer Reviewer</option>
        </select>
      </div>
      <Field label="Display Order" value={position} onChange={setPosition} />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border text-xs uppercase tracking-[0.2em] hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
