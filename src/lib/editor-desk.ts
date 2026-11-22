/** Counts and displayed rows must use the same assignment filter. */
export function editorDeskSections<T extends { initial_reviewer_email?: string | null }>(
  all: T[],
  editorEmail: string,
) {
  const email = editorEmail.trim().toLowerCase();
  return {
    all,
    assigned: all.filter((paper) => paper.initial_reviewer_email?.trim().toLowerCase() === email),
  };
}
