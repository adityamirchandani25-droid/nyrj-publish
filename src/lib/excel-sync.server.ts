// Server-only: mirror every manuscript submission into the NYRJ Submissions
// workbook in OneDrive. Prefer a direct Microsoft Graph access token; the
// Lovable connector remains an optional migration fallback.
const GRAPH_GATEWAY = "https://graph.microsoft.com/v1.0";
const LEGACY_GATEWAY = "https://connector-gateway.lovable.dev/microsoft_excel";
const WORKBOOK_PATH = "/me/drive/root:%2FNYRJ%20Submissions.xlsx:";
const SHEET = "Submissions";

function connection() {
  const graphToken = process.env["MICROSOFT_GRAPH_ACCESS_TOKEN"];
  if (graphToken) {
    return {
      gateway: GRAPH_GATEWAY,
      headers: {
        Authorization: `Bearer ${graphToken}`,
        "Content-Type": "application/json",
      },
    };
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["MICROSOFT_EXCEL_API_KEY"];
  if (!lovableKey || !connKey) return null;
  return {
    gateway: LEGACY_GATEWAY,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
    },
  };
}

/** Neutralizes values a spreadsheet would otherwise execute as a formula. */
function cell(v: unknown): string {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export type SubmissionRowValues = {
  submittedAt: string;
  submissionId: string;
  title: string;
  submitterEmail: string;
  authors: string;
  orcids: string;
  researchType: string;
  status: string;
  decision: string;
  reviewer: string;
};

/** Appends one row. Never throws — logs and returns false on failure. */
export async function appendSubmissionRow(v: SubmissionRowValues): Promise<boolean> {
  const conn = connection();
  if (!conn) {
    console.error("[excel-sync] connector secrets missing");
    return false;
  }
  const values = [
    v.submittedAt,
    v.submissionId,
    v.title,
    v.submitterEmail,
    v.authors,
    v.orcids,
    v.researchType,
    v.status,
    v.decision,
    v.reviewer,
  ].map(cell);

  try {
    const usedRes = await fetch(
      `${conn.gateway}${WORKBOOK_PATH}/workbook/worksheets('${SHEET}')/usedRange(valuesOnly=true)?$select=rowCount`,
      { headers: conn.headers },
    );
    if (!usedRes.ok) {
      console.error("[excel-sync] usedRange failed", usedRes.status, await usedRes.text());
      return false;
    }
    const used = (await usedRes.json()) as { rowCount?: number };
    const nextRow = (used.rowCount ?? 1) + 1;
    const address = `A${nextRow}:J${nextRow}`;

    const patch = await fetch(
      `${conn.gateway}${WORKBOOK_PATH}/workbook/worksheets('${SHEET}')/range(address='${address}')`,
      { method: "PATCH", headers: conn.headers, body: JSON.stringify({ values: [values] }) },
    );
    if (!patch.ok) {
      console.error("[excel-sync] write failed", patch.status, await patch.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[excel-sync] error:", e);
    return false;
  }
}

/**
 * Updates status / decision / reviewer for an existing submission row, matched
 * on the submission id in column B. Never throws.
 */
export async function updateSubmissionRow(
  submissionId: string,
  fields: { status?: string; decision?: string; reviewer?: string },
): Promise<boolean> {
  const conn = connection();
  if (!conn) {
    console.error("[excel-sync] connector secrets missing");
    return false;
  }
  try {
    const res = await fetch(
      `${conn.gateway}${WORKBOOK_PATH}/workbook/worksheets('${SHEET}')/usedRange(valuesOnly=true)?$select=values`,
      { headers: conn.headers },
    );
    if (!res.ok) {
      console.error("[excel-sync] usedRange failed", res.status, await res.text());
      return false;
    }
    const used = (await res.json()) as { values?: unknown[][] };
    const rows = used.values ?? [];
    const idx = rows.findIndex((r) => String(r?.[1] ?? "").trim() === submissionId);
    if (idx < 0) {
      console.error("[excel-sync] row not found for", submissionId);
      return false;
    }
    const existing = rows[idx] ?? [];
    const rowNumber = idx + 1; // usedRange starts at A1
    const values = [
      fields.status ?? String(existing[7] ?? ""),
      fields.decision ?? String(existing[8] ?? ""),
      fields.reviewer ?? String(existing[9] ?? ""),
    ].map(cell);
    const patch = await fetch(
      `${conn.gateway}${WORKBOOK_PATH}/workbook/worksheets('${SHEET}')/range(address='H${rowNumber}:J${rowNumber}')`,
      { method: "PATCH", headers: conn.headers, body: JSON.stringify({ values: [values] }) },
    );
    if (!patch.ok) {
      console.error("[excel-sync] update failed", patch.status, await patch.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[excel-sync] update error:", e);
    return false;
  }
}
