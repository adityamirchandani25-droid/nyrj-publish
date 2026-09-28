import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface ReviewerAccountRequestProps {
  reviewerName?: string;
  reviewerEmail?: string;
  username?: string;
  expertise?: string;
  adminUrl?: string;
}

export function ReviewerAccountRequestEmail({
  reviewerName = "A reviewer",
  reviewerEmail = "",
  username = "",
  expertise = "",
  adminUrl = "https://nyrj.org/admin/submissions",
}: ReviewerAccountRequestProps) {
  return (
    <Html>
      <Head />
      <Preview>A peer reviewer account is waiting for staff approval</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>
            Reviewer account awaiting approval
          </Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            <strong>Name:</strong> {reviewerName}
            <br />
            <strong>Email:</strong> {reviewerEmail}
            <br />
            <strong>Username:</strong> {username}
          </Text>
          {expertise ? (
            <Text style={{ fontSize: "16px", margin: "8px 0" }}>
              <strong>Expertise:</strong> {expertise}
            </Text>
          ) : null}
          <Text style={{ fontSize: "16px", margin: "16px 0" }}>
            Sign in to the staff dashboard, open Reviewer Accounts, and approve or reject this
            request. The applicant cannot access any manuscript until approved.
          </Text>
          <Button
            href={adminUrl}
            style={{
              backgroundColor: "#12263f",
              color: "#ffffff",
              padding: "12px 22px",
              fontSize: "14px",
              borderRadius: "4px",
              display: "inline-block",
            }}
          >
            Open staff dashboard
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReviewerAccountRequestEmail,
  subject: "Reviewer account awaiting approval — National Youth Research Journal",
  displayName: "Reviewer account approval request",
  previewData: {
    reviewerName: "Dr. Rao",
    reviewerEmail: "rao@example.edu",
    username: "drrao",
    expertise: "Molecular biology and statistics",
    adminUrl: "https://nyrj.org/admin/submissions",
  },
} satisfies TemplateEntry;
