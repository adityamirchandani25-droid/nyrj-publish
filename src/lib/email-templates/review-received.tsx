import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface ReviewReceivedProps {
  reviewerName?: string;
  reviewerEmail?: string;
  title?: string;
  submissionId?: string;
  comments?: string;
  attachmentName?: string;
}

export function ReviewReceivedEmail({
  reviewerName = "A reviewer",
  reviewerEmail = "",
  title = "a manuscript",
  submissionId = "—",
  comments = "",
  attachmentName = "",
}: ReviewReceivedProps) {
  return (
    <Html>
      <Head />
      <Preview>A peer review has been submitted</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>Peer review received</Heading>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>Manuscript:</strong> {title}
          </Text>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>Reviewer:</strong> {reviewerName} {reviewerEmail ? `(${reviewerEmail})` : ""}
          </Text>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>Submission ID:</strong> {submissionId}
          </Text>
          <Text style={{ fontSize: "16px", margin: "16px 0 4px" }}>
            <strong>Comments</strong>
          </Text>
          <Text style={{ fontSize: "15px", whiteSpace: "pre-wrap", margin: "4px 0" }}>
            {comments}
          </Text>
          {attachmentName && (
            <Text style={{ fontSize: "15px", margin: "12px 0" }}>
              Reviewer file: {attachmentName}. Open it in the staff dashboard before approving it
              for the author.
            </Text>
          )}
          <Text style={{ fontSize: "13px", color: "#666", marginTop: "24px" }}>
            <a href={`https://nyrj.org/admin/submissions?review=${submissionId}`}>
              Open this paper in the peer review panel
            </a>{" "}
            before forwarding edits to the author.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReviewReceivedEmail,
  subject: "Peer review received — National Youth Research Journal",
  displayName: "Peer review received (editor)",
  previewData: {
    reviewerName: "Dr. Rao",
    reviewerEmail: "rao@example.edu",
    title: "Photocatalytic Degradation of Microplastics",
    submissionId: "0f2b1c44",
    comments: "The methods section is strong…",
  },
} satisfies TemplateEntry;
