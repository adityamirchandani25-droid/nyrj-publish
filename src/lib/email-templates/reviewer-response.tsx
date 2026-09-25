import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ReviewerResponseProps {
  reviewerName?: string
  reviewerEmail?: string
  title?: string
  accepted?: boolean
  dueDate?: string
}

export function ReviewerResponseEmail({
  reviewerName = 'A reviewer',
  reviewerEmail = '',
  title = 'a manuscript',
  accepted = true,
  dueDate = '',
}: ReviewerResponseProps) {
  return (
    <Html>
      <Head />
      <Preview>{accepted ? 'A reviewer accepted an invitation' : 'A reviewer declined an invitation'}</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            {accepted ? 'Review invitation accepted' : 'Review invitation declined'}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '4px 0' }}>
            <strong>Reviewer:</strong> {reviewerName} {reviewerEmail ? `(${reviewerEmail})` : ''}
          </Text>
          <Text style={{ fontSize: '16px', margin: '4px 0' }}>
            <strong>Manuscript:</strong> {title}
          </Text>
          {accepted && dueDate ? (
            <Text style={{ fontSize: '16px', margin: '4px 0' }}>
              <strong>Review due:</strong> {dueDate}
            </Text>
          ) : null}
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '24px' }}>
            {accepted
              ? 'No action needed for now — we will let you know when the review arrives.'
              : 'You may wish to invite another reviewer for this manuscript.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewerResponseEmail,
  subject: 'Reviewer response — National Youth Research Journal',
  displayName: 'Reviewer accepted / declined (editors)',
  previewData: {
    reviewerName: 'Dr. Rao',
    reviewerEmail: 'rao@example.edu',
    title: 'Photocatalytic Degradation of Microplastics',
    accepted: true,
    dueDate: 'October 1, 2026',
  },
} satisfies TemplateEntry
