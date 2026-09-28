import { useEffect, useState } from "react";
import { staffToken } from "@/lib/auth";
import { listVersions, type VersionRow } from "@/lib/editors.functions";
import { signManuscriptDownload } from "@/lib/manuscript-admin.functions";

export function VersionHistory({ submissionId }: { submissionId: string }) {
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listVersions({ data: { staffToken: staffToken(), submissionId } })
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load versions."));
    return () => {
      alive = false;
    };
  }, [submissionId]);

  async function download(path: string, filename: string) {
    try {
      const { url } = await signManuscriptDownload({ data: { staffToken: staffToken(), path } });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.target = "_blank";
      a.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!rows || rows.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Version history</p>
      <ul className="mt-2 space-y-2">
        {rows.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-primary">
              v{v.version} — {v.label}
            </span>
            <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
            <button
              onClick={() => void download(v.manuscript_path, v.manuscript_filename)}
              className="px-2 py-1 border border-border text-[10px] uppercase tracking-[0.18em] hover:bg-muted"
            >
              Download
            </button>
            {v.note && <span className="w-full text-muted-foreground italic">{v.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
