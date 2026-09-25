import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EditorRecommendationProps {
  editorName?: string
  editorEmail?: string
  title?: string
  action?: string
  comments?: string
  dashboardUrl?: string
}

const LABELS: Record<string, string> = {
  accept: 'recommends accepting',
  decline: 'recommends declining',
  formatting: 'has formatting changes to send',
}

export function EditorRecommendationEmail({
  editorName = 'An editor',
  editorEmail = '',
  title = 'a manuscript',
  action = 'formatting',
  comments = '',
  dashboardUrl = 'https://nyrj.org/admin/submissions',
}: EditorRecommendationProps) {
  return (
    <Html>
      <Head />
      <Preview>An editor recommendation is waiting for your approval</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            Editor recommendation awaiting approval
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            {editorName} {editorEmail ? `(${editorEmail})` : ''} {LABELS[action] ?? 'sent a note on'}{' '}
            <strong>&ldquo;{title}&rdquo;</strong>.
          </Text>
          {comments ? (
            <Text style={{ fontSize: '15px', whiteSpace: 'pre-wrap', margin: '16px 0' }}>
              {comments}
            </Text>
          ) : null}
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Nothing has been sent to the author yet. Review and approve it here:{' '}
            <a href={dashboardUrl}>{dashboardUrl}</a>
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
  component: EditorRecommendationEmail,
  subject: 'Editor recommendation awaiting approval — National Youth Research Journal',
  displayName: 'Editor recommendation to staff',
  previewData: {
    editorName: 'Jay',
    editorEmail: 'jay@example.com',
    title: 'Photocatalytic Degradation of Microplastics',
    action: 'formatting',
    comments: 'Figures need captions; references should follow APA 7.',
  },
} satisfies TemplateEntry
