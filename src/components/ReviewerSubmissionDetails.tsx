import type { ReviewerSubmission } from "@/lib/reviewer-submission";

export function ReviewerSubmissionDetails({
  submission,
}: {
  submission?: ReviewerSubmission | null;
}) {
  if (!submission) return null;
  return (
    <div className="mt-4 space-y-4">
      {submission.files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {submission.files.map((file, i) => (
            <a
              key={i}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              {file.label}
            </a>
          ))}
        </div>
      )}
      <details className="border border-border p-4">
        <summary className="cursor-pointer text-sm text-primary">
          Submission details and declarations
        </summary>
        <dl className="mt-3 space-y-3 text-sm">
          {submission.details.map(({ label, value }) => (
            <div key={label}>
              <dt className="font-medium text-primary">{label}</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
