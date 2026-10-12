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

export function AuthorRevisionReminderEmail({
  title = "your manuscript",
  resubmitUrl = "https://nyrj.org/track",
}: {
  title?: string;
  resubmitUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>A friendly follow-up about your manuscript edits</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#fff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px" }}>Checking in about your edits</Heading>
          <Text>
            We sent requested edits for <strong>“{title}”</strong> about ten days ago and wanted to
            check how they are going.
          </Text>
          <Text>
            When your revised manuscript is ready, please upload it to the existing submission. If
            you need more time or have questions, reply to this email.
          </Text>
          <Button
            href={resubmitUrl}
            style={{ backgroundColor: "#12263f", color: "#fff", padding: "12px 20px" }}
          >
            Upload your revision
          </Button>
          <Text>National Youth Research Journal</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: AuthorRevisionReminderEmail,
  subject: "Following up on your manuscript edits — National Youth Research Journal",
  displayName: "Author revision follow-up",
  previewData: { title: "Sample manuscript", resubmitUrl: "https://nyrj.org/track" },
} satisfies TemplateEntry;
