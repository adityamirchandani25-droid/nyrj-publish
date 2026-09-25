import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ReviewerReminderProps {
  reviewerName?: string
  title?: string
  dueDate?: string
  inviteUrl?: string
  /** true = they have not yet accepted or declined */
  awaitingResponse?: boolean
}

export function ReviewerReminderEmail({
  reviewerName = 'Reviewer',
  title = 'a manuscript',
  dueDate = '',
  inviteUrl = 'https://nyrj.org/review',
  awaitingResponse = false,
}: ReviewerReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>A gentle reminder from the National Youth Research Journal</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            {awaitingResponse ? 'A friendly reminder about a review invitation' : 'A friendly reminder about your review'}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>Dear {reviewerName},</Text>
          {awaitingResponse ? (
            <Text style={{ fontSize: '16px', margin: '8px 0' }}>
              We hope this note finds you well. We recently invited you to review the manuscript
              below, and we wanted to gently check in — there is absolutely no pressure, and
              declining is completely fine if your schedule is full.
            </Text>
          ) : (
            <Text style={{ fontSize: '16px', margin: '8px 0' }}>
              We hope this note finds you well, and thank you again for kindly agreeing to review
              the manuscript below. This is simply a gentle reminder — we know how busy things get,
              and we are very grateful for the time you are giving us.
            </Text>
          )}
          <Text style={{ fontSize: '16px', margin: '16px 0 4px' }}>
            <strong>Manuscript:</strong> {title}
          </Text>
          {dueDate ? (
            <Text style={{ fontSize: '15px', margin: '4px 0' }}>
              <strong>Review due:</strong> {dueDate}
            </Text>
          ) : null}
          <Button
            href={inviteUrl}
            style={{
              backgroundColor: '#12263f',
              color: '#ffffff',
              padding: '12px 22px',
              fontSize: '14px',
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '16px',
            }}
          >
            {awaitingResponse ? 'Accept or decline' : 'Open the review form'}
          </Button>
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '16px' }}>
            Or paste this link into your browser: {inviteUrl}
          </Text>
          <Text style={{ fontSize: '15px', marginTop: '16px' }}>
            If you need more time, simply reply to this email — we are always happy to accommodate.
            Thank you for supporting young researchers.
          </Text>
          <Text style={{ fontSize: '15px', margin: '16px 0 0' }}>
            With warm regards,
            <br />
            The Editorial Team, National Youth Research Journal
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewerReminderEmail,
  subject: 'A gentle reminder — National Youth Research Journal',
  displayName: 'Reviewer reminder (gentle follow-up)',
  previewData: {
    reviewerName: 'Dr. Rao',
    title: 'Photocatalytic Degradation of Microplastics',
    dueDate: 'October 1, 2026',
    inviteUrl: 'https://nyrj.org/review?token=abc',
    awaitingResponse: false,
  },
} satisfies TemplateEntry
