import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export function AuthorRevisionOverdueEmail({
  title = "a manuscript",
  authorEmail = "",
  requestedDate = "",
  dashboardUrl = "https://nyrj.org/admin/submissions",
}: {
  title?: string;
  authorEmail?: string;
  requestedDate?: string;
  dashboardUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>An author revision has been outstanding for a month</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#fff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px" }}>Check on an outstanding revision</Heading>
          <Text>
            The revision for <strong>“{title}”</strong> has not been received a month after edits
            were sent{requestedDate ? ` on ${requestedDate}` : ""}.
          </Text>
          <Text>
            Author: {authorEmail}. Please check whether they are still active and whether they need
            more time.
          </Text>
          <Text>
            <a href={dashboardUrl}>Open the staff dashboard</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: AuthorRevisionOverdueEmail,
  subject: "Author revision outstanding for a month — National Youth Research Journal",
  displayName: "Author revision overdue (staff)",
  previewData: { title: "Sample manuscript", authorEmail: "author@example.com" },
} satisfies TemplateEntry;
