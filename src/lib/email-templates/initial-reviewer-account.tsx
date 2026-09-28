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

export interface InitialReviewerAccountProps {
  reviewerName?: string;
  actionUrl?: string;
  existingAccount?: boolean;
}

export function InitialReviewerAccountEmail({
  reviewerName = "Reviewer",
  actionUrl = "https://nyrj.org/initial-reviewer",
  existingAccount = false,
}: InitialReviewerAccountProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {existingAccount
          ? "Set the password for your initial reviewer account"
          : "Confirm your initial reviewer account"}
      </Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "Georgia, serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "600px" }}>
          <Heading style={{ fontSize: "22px", margin: "0 0 16px" }}>
            {existingAccount ? "Set your reviewer password" : "Confirm your reviewer account"}
          </Heading>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>Hi {reviewerName},</Text>
          <Text style={{ fontSize: "16px", margin: "8px 0" }}>
            {existingAccount
              ? "An NYRJ account already exists for this email. Use the secure link below to choose its password, then you will be taken to your initial reviewer desk."
              : "Your initial reviewer account is ready. Confirm your email with the secure link below to finish setting it up."}
          </Text>
          <Button
            href={actionUrl}
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
            {existingAccount ? "Set password securely" : "Confirm account"}
          </Button>
          <Text style={{ fontSize: "14px", color: "#555", margin: "20px 0 8px" }}>
            This secure link is intended only for the person who requested the account. If that was
            not you, you can safely ignore this message.
          </Text>
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
  component: InitialReviewerAccountEmail,
  subject: (data: Record<string, unknown>) =>
    data.existingAccount
      ? "Set your initial reviewer password — National Youth Research Journal"
      : "Confirm your initial reviewer account — National Youth Research Journal",
  displayName: "Initial reviewer account confirmation",
  previewData: {
    reviewerName: "Jay",
    actionUrl: "https://nyrj.org/initial-reviewer",
    existingAccount: false,
  },
} satisfies TemplateEntry;
