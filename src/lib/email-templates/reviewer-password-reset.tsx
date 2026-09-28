import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface ReviewerPasswordResetProps {
  reviewerName?: string;
  resetUrl?: string;
}

export function ReviewerPasswordResetEmail({
  reviewerName = "Reviewer",
  resetUrl = "https://nyrj.org/review",
}: ReviewerPasswordResetProps) {
  return (
    <Html>
      <Head />
      <Preview>Set a new password for your reviewer account</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>Reset your password</Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>Dear {reviewerName},</Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            We received a request to reset the password for your peer reviewer account. You can
            choose a new one using the secure link below. It stays valid for one hour.
          </Text>
          <Text style={{ fontSize: "16px", margin: "20px 0" }}>
            <Link href={resetUrl} style={{ color: "#1a4d8f" }}>
              Choose a new password
            </Link>
          </Text>
          <Text style={{ fontSize: "15px", margin: "8px 0", color: "#555" }}>
            If you did not request this, you can safely ignore this message — your current password
            will keep working.
          </Text>
          <Text style={{ fontSize: "15px", margin: "16px 0 0" }}>
            With thanks,
            <br />
            The Editorial Team, National Youth Research Journal
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReviewerPasswordResetEmail,
  subject: "Reset your reviewer password — National Youth Research Journal",
  displayName: "Reviewer password reset",
  previewData: {
    reviewerName: "Dr. Rao",
    resetUrl: "https://nyrj.org/review?reset=abc123",
  },
} satisfies TemplateEntry;
