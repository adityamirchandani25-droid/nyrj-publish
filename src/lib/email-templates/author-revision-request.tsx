import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface AuthorRevisionRequestProps {
  authorName?: string
  title?: string
  body?: string
  resubmitUrl?: string
}

export function AuthorRevisionRequestEmail({
  authorName = 'there',
  title = 'your manuscript',
  body = '',
  resubmitUrl = 'https://nyrj.org/resubmit',
}: AuthorRevisionRequestProps) {
  return (
    <Html>
      <Head />
      <Preview>Formatting changes for your manuscript</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            A few changes for your manuscript
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>Hi {authorName},</Text>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Thank you for your patience while our editors read{' '}
            <strong>&ldquo;{title}&rdquo;</strong>. Below are the changes we would love to see
            before the next step.
          </Text>
          <Text style={{ fontSize: '15px', whiteSpace: 'pre-wrap', margin: '16px 0' }}>{body}</Text>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            When your revised file is ready, please upload it here — it attaches straight to your
            existing submission, so there is no need to start a new one:
          </Text>
          <Text style={{ fontSize: '16px', margin: '16px 0' }}>
            <a
              href={resubmitUrl}
              style={{
                backgroundColor: '#1a2b4c',
                color: '#ffffff',
                padding: '12px 20px',
                textDecoration: 'none',
                borderRadius: '4px',
              }}
            >
              Upload your revised manuscript
            </a>
          </Text>
          <Text style={{ fontSize: '14px', color: '#555', margin: '8px 0' }}>
            Or paste this link into your browser: {resubmitUrl}
          </Text>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            If anything is unclear, or you need more time, simply reply to this email — we are
            always glad to help.
          </Text>
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '24px' }}>
            National Youth Research Journal — Open Access, Peer-Reviewed
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AuthorRevisionRequestEmail,
  subject: 'Requested changes to your manuscript — National Youth Research Journal',
  displayName: 'Revision request with resubmit link',
  previewData: {
    authorName: 'Jane',
    title: 'Photocatalytic Degradation of Microplastics',
    body: 'Please add figure captions and format references in APA 7.',
    resubmitUrl: 'https://nyrj.org/resubmit?token=abc123',
  },
} satisfies TemplateEntry
