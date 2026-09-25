// Shared library backed by Supabase: any visitor (including phones) sees
// the same published manuscripts. Writes go through staff-gated server fns.

import { libraryAdd, libraryList, libraryRemove, libraryUpdate } from "@/lib/library.functions";
import { staffToken } from "@/lib/auth";

export type LibraryEntry = {
  id: string;
  slug: string;
  nyrjId?: string;
  doi?: string;
  featured: boolean;
  awardWinner: boolean;
  awardLabel?: string;
  citationCount: number;
  title: string;
  authors: string;
  issue?: string;
  topic?: string;
  grade?: string;
  publicationDate?: string;
  orcids?: string[];
  fileName: string;
  mimeType: string;
  /** Signed URL to the manuscript file. */
  dataUrl: string;
  addedAt: number;
};

type Row = {
  id: string;
  slug: string | null;
  nyrj_id: string | null;
  doi: string | null;
  featured: boolean | null;
  award_winner: boolean | null;
  award_label: string | null;
  citation_count: number | null;
  title: string;
  authors: string;
  issue: string | null;
  topic: string | null;
  grade: string | null;
  publication_date: string | null;
  orcids: string[] | null;
  file_name: string;
  mime_type: string;
  file_path: string;
  added_at: string;
  signed_url?: string;
};

function rowToEntry(r: Row): LibraryEntry {
  return {
    id: r.id,
    slug: r.slug ?? r.id,
    nyrjId: r.nyrj_id ?? undefined,
    doi: r.doi ?? undefined,
    featured: Boolean(r.featured),
    awardWinner: Boolean(r.award_winner),
    awardLabel: r.award_label ?? undefined,
    citationCount: r.citation_count ?? 0,
    title: r.title,
    authors: r.authors,
    issue: r.issue ?? undefined,
    topic: r.topic ?? undefined,
    grade: r.grade ?? undefined,
    publicationDate: r.publication_date ?? undefined,
    orcids: r.orcids ?? undefined,
    fileName: r.file_name,
    mimeType: r.mime_type,
    dataUrl: r.signed_url ?? "",
    addedAt: new Date(r.added_at).getTime(),
  };
}

export async function getLibrary(): Promise<LibraryEntry[]> {
  const rows = (await libraryList()) as unknown as Row[];
  return rows.map(rowToEntry);
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

export async function addEntry(input: {
  title: string;
  authors: string;
  issue?: string;
  topic?: string;
  authorEmail?: string;
  keywords?: string[];
  doi?: string;
  orcids?: string[];
  awardWinner?: boolean;
  awardLabel?: string;
  featured?: boolean;
  file: File;
}): Promise<LibraryEntry> {
  const fileBase64 = await fileToBase64(input.file);
  const row = (await libraryAdd({
    data: {
      staffToken: staffToken(),
      title: input.title,
      authors: input.authors,
      issue: input.issue,
      topic: input.topic,
      authorEmail: input.authorEmail,
      keywords: input.keywords,
      doi: input.doi,
      orcids: input.orcids,
      awardWinner: input.awardWinner,
      awardLabel: input.awardLabel,
      featured: input.featured,
      fileName: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      fileBase64,
    },
  })) as unknown as Row;
  return rowToEntry(row);
}

export async function removeEntry(id: string): Promise<void> {
  await libraryRemove({ data: { staffToken: staffToken(), id } });
}

export async function updateEntry(
  id: string,
  patch: {
    doi?: string | null;
    featured?: boolean;
    awardWinner?: boolean;
    awardLabel?: string | null;
    orcids?: string[] | null;
    issue?: string | null;
    publicationDate?: string | null;
  },
): Promise<void> {
  await libraryUpdate({
    data: { staffToken: staffToken(), id, ...patch },
  });
}
