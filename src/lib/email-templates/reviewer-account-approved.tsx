import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ReviewerAccountApprovedProps {
  reviewerName?: string
  approved?: boolean
}

export function ReviewerAccountApprovedEmail({
  reviewerName = 'there',
  approved = true,
}: ReviewerAccountApprovedProps) {
  return (
    <Html>
      <Head />
      <Preview>Your peer reviewer account</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            {approved ? 'Your reviewer account is active' : 'About your reviewer request'}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>Hi {reviewerName},</Text>
          {approved ? (
            <>
              <Text style={{ fontSize: '16px', margin: '8px 0' }}>
                Your peer reviewer account with the National Youth Research Journal has been
                approved. You can now sign in at nyrj.org with the username and password you
                chose, and you will see every manuscript assigned to you.
              </Text>
              <Text style={{ fontSize: '16px', margin: '8px 0' }}>
                Thank you for supporting student research.
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: '16px', margin: '8px 0' }}>
              Thank you for your interest in reviewing for us. We are not able to activate your
              reviewer account at this time, but we truly appreciate you offering your time.
            </Text>
          )}
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '24px' }}>
            National Youth Research Journal — Open Access, Peer-Reviewed
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewerAccountApprovedEmail,
  subject: 'Your peer reviewer account — National Youth Research Journal',
  displayName: 'Reviewer account decision',
  previewData: { reviewerName: 'Dr. Rao', approved: true },
} satisfies TemplateEntry
