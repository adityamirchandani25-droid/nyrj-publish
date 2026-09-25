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

export interface InitialReviewAssignmentProps {
  reviewerName?: string;
  title?: string;
  submissionId?: string;
  dashboardUrl?: string;
}

export function InitialReviewAssignmentEmail({
  reviewerName = "there",
  title = "a manuscript",
  submissionId = "",
  dashboardUrl = "https://nyrj.org/initial-reviewer",
}: InitialReviewAssignmentProps) {
  return (
    <Html>
      <Head />
      <Preview>You have been assigned a manuscript for initial review</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>
            A paper has been assigned to you
          </Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>Hi {reviewerName},</Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            You have been assigned the initial review for the manuscript below. Whenever you get the
            chance, please take a look at it soon so the author is not kept waiting — thank you for
            keeping things moving.
          </Text>
          <Text style={{ fontSize: "16px", margin: "16px 0 4px" }}>
            <strong>Title:</strong> {title}
          </Text>
          {submissionId ? (
            <Text style={{ fontSize: "13px", color: "#666", margin: "4px 0" }}>
              Submission ID: {submissionId}
            </Text>
          ) : null}
          <Text style={{ fontSize: "16px", margin: "16px 0 8px" }}>
            Sign in with the email address that received this message. The paper will already be
            waiting in your reviewer desk, where you can download it and send your recommendation
            and author comments to staff for approval.
          </Text>
          <Button
            href={dashboardUrl}
            style={{
              backgroundColor: "#12263f",
              color: "#ffffff",
              padding: "12px 22px",
              fontSize: "14px",
              borderRadius: "4px",
              display: "inline-block",
              marginTop: "12px",
            }}
          >
            Open the initial reviewer login
          </Button>
          <Text style={{ fontSize: "16px", margin: "20px 0 8px" }}>
            Thank you,
            <br />
            National Youth Research Journal
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: InitialReviewAssignmentEmail,
  subject: "A paper has been assigned to you — National Youth Research Journal",
  displayName: "Initial reviewer assignment",
  previewData: {
    reviewerName: "Jay",
    title: "Photocatalytic Degradation of Microplastics",
    submissionId: "0000-1111",
    dashboardUrl: "https://nyrj.org/initial-reviewer",
  },
} satisfies TemplateEntry;
