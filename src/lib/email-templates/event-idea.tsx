import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EventIdeaProps {
  studentEmail?: string
  title?: string
  description?: string
}

export function EventIdeaEmail({
  studentEmail = 'student@example.com',
  title = 'Untitled idea',
  description = '',
}: EventIdeaProps) {
  return (
    <Html>
      <Head />
      <Preview>New event idea: {title}</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '20px', margin: '0 0 16px' }}>New event idea</Heading>
          <Text style={{ margin: '4px 0' }}><strong>Title:</strong> {title}</Text>
          <Text style={{ margin: '4px 0' }}><strong>From:</strong> {studentEmail}</Text>
          {description ? (
            <Text style={{ margin: '12px 0 0' }}>{description}</Text>
          ) : null}
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '24px' }}>
            National Youth Research Journal — staff notification
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventIdeaEmail,
  subject: (d: Record<string, any>) => `New event idea: ${d['title'] ?? 'submission'}`,
  displayName: 'Event idea (staff)',
  to: 'NYRJINFO@gmail.com',
  previewData: {
    studentEmail: 'student@example.com',
    title: 'Regional science symposium',
    description: 'A one-day symposium hosted with local chapters.',
  },
} satisfies TemplateEntry
