import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface ManuscriptSubmissionProps {
  submitterEmail?: string
  title?: string
  researchType?: string
  authors?: string
  submissionId?: string
}

export function ManuscriptSubmissionEmail({
  submitterEmail = 'student@example.com',
  title = 'Untitled manuscript',
  submissionId = '—',
}: ManuscriptSubmissionProps) {
  return (
    <Html>
      <Head />
      <Preview>New submission received: {title}</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '20px', margin: '0 0 16px' }}>
            A submission was made
          </Heading>
          <Text style={{ margin: '4px 0' }}><strong>Title:</strong> {title}</Text>
          <Text style={{ margin: '4px 0' }}><strong>Submitted by:</strong> {submitterEmail}</Text>
          <Text style={{ margin: '4px 0' }}><strong>Submission ID:</strong> {submissionId}</Text>
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '24px' }}>
            National Youth Research Journal — staff notification
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ManuscriptSubmissionEmail,
  subject: (d: Record<string, any>) => `New submission: ${d['title'] ?? 'manuscript'}`,
  displayName: 'Manuscript submission (staff)',
  previewData: {
    submitterEmail: 'student@example.com',
    title: 'Photocatalytic Degradation of Microplastics',
    submissionId: '0f2b1c44',
  },
} satisfies TemplateEntry
