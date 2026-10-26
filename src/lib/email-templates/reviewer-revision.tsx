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

export function ReviewerRevisionEmail({
  reviewerName = "Reviewer",
  title = "a manuscript",
  version = 2,
  submittedAt = "",
  reviewUrl = "https://nyrj.org/review",
}: {
  reviewerName?: string;
  title?: string;
  version?: number;
  submittedAt?: string;
  reviewUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Revised manuscript ready for review</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif" }}>
        <Container style={{ backgroundColor: "white", padding: "32px", maxWidth: "600px" }}>
          <Heading>New revision: {title}</Heading>
          <Text>Hello {reviewerName},</Text>
          <Text>
            Version {version} of this manuscript was submitted on {submittedAt}. Your secure review
            link opens the newest manuscript after you sign in.
          </Text>
          <Button href={reviewUrl}>Open revised manuscript</Button>
          <Text>National Youth Research Journal</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReviewerRevisionEmail,
  subject: (data: Record<string, unknown>) =>
    `Revised manuscript v${data.version ?? 2}: ${data.title ?? "Review assignment"}`,
  displayName: "Reviewer manuscript revision",
  previewData: { title: "Sample manuscript", version: 2 },
} satisfies TemplateEntry;
