import { z } from "zod";

// Deterministic citation formatting shared by the article page (instant APA
// preview) and the server (fallback and machine-readable formats).

const SITE_URL = "https://nyrj.org";
export const CITATION_JOURNAL_TITLE = "National Youth Research Journal";
export const CITATION_ISSN = "3143-3030";

export const humanCitationsSchema = z.object({
  apa: z.string().min(20).max(4_000),
  mla: z.string().min(20).max(4_000),
  chicago: z.string().min(20).max(4_000),
});

export const citationBundleSchema = humanCitationsSchema.extend({
  bibtex: z.string().min(20).max(8_000),
  ris: z.string().min(20).max(8_000),
});

export type CitationBundle = z.infer<typeof citationBundleSchema>;

export type CitationArticle = {
  id: string;
  slug: string;
  nyrj_id: string | null;
  doi: string | null;
  title: string;
  authors: string;
  issue: string | null;
  publication_date: string | null;
  added_at: string;
};

export function splitAuthors(authors: string): string[] {
  if (authors.includes(";")) {
    return authors
      .split(/\s*;\s*/)
      .map((author) => {
        const parts = author.split(/\s*,\s*/);
        return parts.length === 2 ? `${parts[1]} ${parts[0]}`.trim() : author.trim();
      })
      .filter(Boolean);
  }
  return authors
    .split(/\s*(?:,|;| and | & )\s*/i)
    .map((author) => author.trim())
    .filter(Boolean);
}

export function publicationYear(article: CitationArticle): string {
  return (article.publication_date ?? article.added_at).slice(0, 4);
}

export function normalizedDoi(doi: string | null): string | null {
  const value = doi
    ?.trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  return value || null;
}

export function articleUrl(article: CitationArticle): string {
  const doi = normalizedDoi(article.doi);
  return doi ? `https://doi.org/${doi}` : `${SITE_URL}/article/${article.slug}`;
}

function nameParts(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) ?? fullName };
}

/** "Last, First" for the lead author of MLA and Chicago bibliographies. */
function invertedName(fullName: string) {
  const { first, last } = nameParts(fullName);
  return first ? `${last}, ${first}` : last;
}

function formatApaAuthors(authors: string[]) {
  const formatted = authors.map((author) => {
    const { first, last } = nameParts(author);
    const initials = first
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => `${name.charAt(0).toUpperCase()}.`)
      .join(" ");
    return initials ? `${last}, ${initials}` : last;
  });
  if (formatted.length <= 1) return formatted[0] ?? "Unknown author";
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted.at(-1)}`;
}

function formatMlaAuthors(authors: string[]) {
  if (authors.length === 0) return "Unknown author";
  const lead = invertedName(authors[0]);
  if (authors.length === 1) return lead;
  if (authors.length === 2) return `${lead}, and ${authors[1]}`;
  return `${lead}, et al.`;
}

function formatChicagoAuthors(authors: string[]) {
  if (authors.length === 0) return "Unknown author";
  const names = [invertedName(authors[0]), ...authors.slice(1)];
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function escapeBibtex(value: string) {
  return value.replace(/\\/g, "\\textbackslash{}").replace(/[{}]/g, (char) => `\\${char}`);
}

function bibtexKey(article: CitationArticle, authors: string[], year: string) {
  const raw = article.nyrj_id || `${nameParts(authors[0] ?? "nyrj").last}${year}${article.slug}`;
  return raw.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || `nyrj${year}`;
}

export function buildCitationBundle(article: CitationArticle): CitationBundle {
  const authors = splitAuthors(article.authors);
  const year = publicationYear(article);
  const url = articleUrl(article);
  const doi = normalizedDoi(article.doi);
  const issue = article.issue ? `, ${article.issue}` : "";
  const bibtexFields = [
    `  author = {${escapeBibtex(authors.join(" and "))}},`,
    `  title = {${escapeBibtex(article.title)}},`,
    `  journal = {${CITATION_JOURNAL_TITLE}},`,
    `  year = {${year}},`,
    ...(article.issue ? [`  number = {${escapeBibtex(article.issue)}},`] : []),
    `  issn = {${CITATION_ISSN}},`,
    ...(doi ? [`  doi = {${escapeBibtex(doi)}},`] : []),
    `  url = {${url}}`,
  ];

  return {
    apa: `${formatApaAuthors(authors)} (${year}). ${article.title}. ${CITATION_JOURNAL_TITLE}${issue}. ${url}`,
    mla: `${formatMlaAuthors(authors)}. “${article.title}.” ${CITATION_JOURNAL_TITLE}${issue}, ${year}, ${url}.`,
    chicago: `${formatChicagoAuthors(authors)}. “${article.title}.” ${CITATION_JOURNAL_TITLE}${article.issue ? ` ${article.issue}` : ""} (${year}). ${url}.`,
    bibtex: `@article{${bibtexKey(article, authors, year)},\n${bibtexFields.join("\n")}\n}`,
    ris: [
      "TY  - JOUR",
      `TI  - ${article.title}`,
      ...authors.map((author) => `AU  - ${author}`),
      `PY  - ${year}`,
      `JO  - ${CITATION_JOURNAL_TITLE}`,
      ...(article.issue ? [`IS  - ${article.issue}`] : []),
      `SN  - ${CITATION_ISSN}`,
      ...(doi ? [`DO  - ${doi}`] : []),
      `UR  - ${url}`,
      "ER  -",
    ].join("\n"),
  };
}
