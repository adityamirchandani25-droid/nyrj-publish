import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface RevisionReceivedProps {
  title?: string
  version?: number
  submitterEmail?: string
  toAuthor?: boolean
  note?: string
}

export function RevisionReceivedEmail({
  title = 'a manuscript',
  version = 2,
  submitterEmail = '',
  toAuthor = false,
  note = '',
}: RevisionReceivedProps) {
  return (
    <Html>
      <Head />
      <Preview>Revised manuscript received</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            {toAuthor ? 'We have your revised manuscript' : 'A revised manuscript came in'}
          </Heading>
          {toAuthor ? (
            <Text style={{ fontSize: '16px', margin: '8px 0' }}>
              Thank you — version {version} of <strong>&ldquo;{title}&rdquo;</strong> has been
              received and is now with our editors. We will be in touch as soon as we have news.
            </Text>
          ) : (
            <Text style={{ fontSize: '16px', margin: '8px 0' }}>
              Version {version} of <strong>&ldquo;{title}&rdquo;</strong> was uploaded
              {submitterEmail ? ` by ${submitterEmail}` : ''}. Earlier versions are kept on the
              submission for comparison.
            </Text>
          )}
          {note ? (
            <Text style={{ fontSize: '15px', whiteSpace: 'pre-wrap', margin: '16px 0' }}>
              Author note: {note}
            </Text>
          ) : null}
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '24px' }}>
            National Youth Research Journal — Open Access, Peer-Reviewed
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RevisionReceivedEmail,
  subject: 'Revised manuscript received — National Youth Research Journal',
  displayName: 'Revision received',
  previewData: { title: 'Photocatalytic Degradation of Microplastics', version: 2 },
} satisfies TemplateEntry
