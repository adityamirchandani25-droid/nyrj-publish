import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface ReviewerNoResponseProps {
  reviewerName?: string;
  reviewerEmail?: string;
  title?: string;
  submissionId?: string;
  dueDate?: string;
  acceptedInvitation?: boolean;
  dashboardUrl?: string;
}

export function ReviewerNoResponseEmail({
  reviewerName = "The assigned reviewer",
  reviewerEmail = "",
  title = "a manuscript",
  submissionId = "—",
  dueDate = "",
  acceptedInvitation = false,
  dashboardUrl = "https://nyrj.org/admin/submissions",
}: ReviewerNoResponseProps) {
  return (
    <Html>
      <Head />
      <Preview>A peer-review deadline passed without a completed review</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>
            Peer-review deadline passed
          </Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            No completed peer review was received within the 15-day review window. Please open the
            paper and assign another reviewer.
          </Text>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>Manuscript:</strong> {title}
          </Text>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>Submission ID:</strong> {submissionId}
          </Text>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>Reviewer:</strong> {reviewerName} {reviewerEmail ? `(${reviewerEmail})` : ""}
          </Text>
          <Text style={{ fontSize: "16px", margin: "4px 0" }}>
            <strong>What happened:</strong>{" "}
            {acceptedInvitation
              ? "The invitation was accepted, but no review was submitted."
              : "The reviewer did not respond to the invitation."}
          </Text>
          {dueDate ? (
            <Text style={{ fontSize: "16px", margin: "4px 0" }}>
              <strong>Deadline:</strong> {dueDate}
            </Text>
          ) : null}
          <Text style={{ fontSize: "16px", margin: "20px 0" }}>
            <a
              href={dashboardUrl}
              style={{
                backgroundColor: "#1a2b4c",
                color: "#ffffff",
                padding: "12px 20px",
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              Open the staff dashboard
            </a>
          </Text>
          <Text style={{ fontSize: "13px", color: "#666", marginTop: "24px" }}>
            The paper history now records that the reviewer deadline passed without a response.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReviewerNoResponseEmail,
  subject: (data) => `Reviewer deadline passed${data.title ? ` — ${String(data.title)}` : ""}`,
  displayName: "Reviewer deadline passed (staff alert)",
  previewData: {
    reviewerName: "Dr. Rao",
    reviewerEmail: "rao@example.edu",
    title: "Photocatalytic Degradation of Microplastics",
    submissionId: "0f2b1c44",
    dueDate: "October 1, 2026",
    acceptedInvitation: false,
    dashboardUrl: "https://nyrj.org/admin/submissions",
  },
} satisfies TemplateEntry;
