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

export function InitialReviewWorkloadEmail({
  reviewerName = "Reviewer",
  titles = [],
  dashboardUrl = "https://nyrj.org/initial-reviewer",
}: {
  reviewerName?: string;
  titles?: string[];
  dashboardUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>A reminder about your initial reviews</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#fff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px" }}>Your initial reviews are waiting</Heading>
          <Text>
            Hi {reviewerName}, thank you for helping move these manuscripts forward. When you have
            time, please send your recommendations for the papers still waiting in your reviewer
            desk.
          </Text>
          {titles.map((title, index) => (
            <Text key={index}>• {title}</Text>
          ))}
          <Button
            href={dashboardUrl}
            style={{ backgroundColor: "#12263f", color: "#fff", padding: "12px 20px" }}
          >
            Open your reviewer desk
          </Button>
          <Text>If you need help or more time, please reply to this email.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: InitialReviewWorkloadEmail,
  subject: "Your initial reviews — National Youth Research Journal",
  displayName: "Initial reviewer daily follow-up",
  previewData: { reviewerName: "Jay", titles: ["Sample manuscript"] },
} satisfies TemplateEntry;
