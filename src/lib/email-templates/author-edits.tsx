import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface AuthorEditsProps {
  authorName?: string;
  title?: string;
  body?: string;
  resubmitUrl?: string;
}

export function AuthorEditsEmail({
  authorName = "there",
  title = "your manuscript",
  body = "",
  resubmitUrl = "https://nyrj.org/resubmit",
}: AuthorEditsProps) {
  return (
    <Html>
      <Head />
      <Preview>Reviewer feedback on your manuscript</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>
            Reviewer feedback on your manuscript
          </Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>Hi {authorName},</Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            Thank you for your patience while <strong>"{title}"</strong> was peer reviewed. Below is
            the feedback from our review process. Please read it carefully and revise your
            manuscript accordingly.
          </Text>
          <Text style={{ fontSize: "15px", whiteSpace: "pre-wrap", margin: "16px 0" }}>{body}</Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            Whenever you are ready, we would be grateful to receive your revised manuscript within
            the next two weeks so that we can prepare it for our library. Upload it directly to your
            existing submission here — there is no need to email the file or start a new submission:
          </Text>
          <Text style={{ fontSize: "16px", margin: "20px 0" }}>
            <a
              href={resubmitUrl}
              style={{
                backgroundColor: "#1a2b4c",
                color: "#ffffff",
                padding: "12px 20px",
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              Upload your revised manuscript
            </a>
          </Text>
          <Text style={{ fontSize: "14px", color: "#555", margin: "8px 0" }}>
            Or paste this link into your browser: {resubmitUrl}
          </Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            If you need more time, or if anything here is unclear, please reply to this email — we
            are always happy to help and to work around your schedule.
          </Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            Thank you for your thoughtful work and for trusting us with your research.
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
  component: AuthorEditsEmail,
  subject: "Reviewer feedback on your manuscript — National Youth Research Journal",
  displayName: "Reviewer edits to author",
  previewData: {
    authorName: "Jane",
    title: "Photocatalytic Degradation of Microplastics",
    body: "Please clarify the sampling procedure…",
    resubmitUrl: "https://nyrj.org/resubmit?token=abc123",
  },
} satisfies TemplateEntry;
