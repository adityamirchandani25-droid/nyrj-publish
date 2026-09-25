import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EditorAccountApprovedProps {
  editorName?: string
  approved?: boolean
}

export function EditorAccountApprovedEmail({
  editorName = 'there',
  approved = true,
}: EditorAccountApprovedProps) {
  return (
    <Html>
      <Head />
      <Preview>{approved ? 'Your editor account is ready' : 'About your editor account'}</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            {approved ? 'Your editor account is ready' : 'About your editor account'}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>Hi {editorName},</Text>
          {approved ? (
            <>
              <Text style={{ fontSize: '16px', margin: '8px 0' }}>
                Thank you for joining the editorial desk of the National Youth Research Journal.
                Your account has been approved, and you can now sign in at{' '}
                <a href="https://nyrj.org/login?account=staff">nyrj.org/login</a> — choose
                &ldquo;Editor&rdquo; on the staff card and use the username and password you chose.
              </Text>
              <Text style={{ fontSize: '16px', margin: '8px 0' }}>
                Inside you will find the papers assigned to you, plus the full desk of submissions.
                Please take good care with anything outside your own assignments.
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: '16px', margin: '8px 0' }}>
              Thank you for your interest in joining our editorial desk. We are not able to open an
              account at this time, but we truly appreciate you offering your time. Please feel free
              to reply to this email with any questions.
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
  component: EditorAccountApprovedEmail,
  subject: 'Your editor account — National Youth Research Journal',
  displayName: 'Editor account decision',
  previewData: { editorName: 'Jay', approved: true },
} satisfies TemplateEntry
