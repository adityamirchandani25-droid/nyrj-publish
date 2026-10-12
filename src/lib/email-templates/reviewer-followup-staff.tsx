import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export function ReviewerFollowupStaffEmail({
  reviewerName = "Peer reviewer",
  reviewerEmail = "",
  title = "a manuscript",
  dueDate = "",
  dashboardUrl = "https://nyrj.org/admin/submissions",
}: {
  reviewerName?: string;
  reviewerEmail?: string;
  title?: string;
  dueDate?: string;
  dashboardUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Peer reviewer follow-up sent</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#fff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px" }}>Peer reviewer follow-up sent</Heading>
          <Text>
            A follow-up email has been sent to {reviewerName}
            {reviewerEmail ? ` (${reviewerEmail})` : ""} about <strong>“{title}”</strong>.
          </Text>
          {dueDate && (
            <Text>
              Their review is still due on <strong>{dueDate}</strong>.
            </Text>
          )}
          <Text>
            <a href={dashboardUrl}>Open this paper in the Peer Review tab</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReviewerFollowupStaffEmail,
  subject: (data) =>
    `Follow-up sent to ${String(data.reviewerName || "peer reviewer")} — ${String(data.title || "manuscript")}`,
  displayName: "Reviewer follow-up sent (staff update)",
  previewData: {
    reviewerName: "Dr. Rao",
    reviewerEmail: "rao@example.edu",
    title: "Sample manuscript",
    dueDate: "10/27/26",
  },
} satisfies TemplateEntry;
