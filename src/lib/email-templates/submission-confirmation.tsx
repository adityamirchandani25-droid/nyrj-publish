import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface SubmissionConfirmationProps {
  submitterName?: string;
  title?: string;
  submissionId?: string;
}

export function SubmissionConfirmationEmail({
  submitterName = "there",
  title = "your manuscript",
  submissionId = "—",
}: SubmissionConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your submission to NYRJ has been received</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>
            We've received your submission!
          </Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>Hi {submitterName},</Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            Thank you for submitting <strong>"{title}"</strong> to the National Youth Research
            Journal. Your paper was successfully submitted and we have received it.
          </Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            Your submission ID is <strong>{submissionId}</strong>. You can use this to track the
            status of your paper through the review process.
          </Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            Our editorial team will review your submission and get back to you soon. You'll receive
            an email whenever the status of your paper changes.
          </Text>
          <Text style={{ fontSize: "13px", color: "#666", marginTop: "24px" }}>
            National Youth Research Journal — Open Access, Peer-Reviewed
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: SubmissionConfirmationEmail,
  subject: "Your submission has been received — National Youth Research Journal",
  displayName: "Submission confirmation (submitter)",
  previewData: {
    submitterName: "Jane",
    title: "Photocatalytic Degradation of Microplastics",
    submissionId: "0f2b1c44",
  },
} satisfies TemplateEntry;
