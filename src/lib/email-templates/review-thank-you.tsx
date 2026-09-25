import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ReviewThankYouProps {
  reviewerName?: string
  title?: string
}

export function ReviewThankYouEmail({
  reviewerName = 'Reviewer',
  title = 'the manuscript',
}: ReviewThankYouProps) {
  return (
    <Html>
      <Head />
      <Preview>Thank you for your review</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            Thank you for your review
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>Dear {reviewerName},</Text>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Thank you very much for sending us your comments on <strong>{title}</strong>. We have
            received them safely, and our editorial team will read them carefully before sharing
            the feedback with the author.
          </Text>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Your generosity with your time genuinely helps young researchers grow, and we are
            grateful for it. We hope we may call on your expertise again in the future.
          </Text>
          <Text style={{ fontSize: '15px', margin: '16px 0 0' }}>
            With sincere thanks,
            <br />
            The Editorial Team, National Youth Research Journal
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewThankYouEmail,
  subject: 'Thank you for your review — National Youth Research Journal',
  displayName: 'Thank you for your review (reviewer)',
  previewData: {
    reviewerName: 'Dr. Rao',
    title: 'Photocatalytic Degradation of Microplastics',
  },
} satisfies TemplateEntry
