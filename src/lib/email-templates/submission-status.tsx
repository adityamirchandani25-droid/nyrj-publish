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

export interface SubmissionStatusProps {
  title?: string
  status?: string
  decision?: string
  authorName?: string
  note?: string
}

type Copy = { headline: string; body: string }

const STATUS_COPY: Record<string, Copy> = {
  'pending / in review': {
    headline: 'Your manuscript has been received',
    body: 'Thank you for submitting to the National Youth Research Journal. Your manuscript is now in our queue and will be assigned to a peer reviewer shortly. We will email you again once the initial review begins.',
  },
  'initial review': {
    headline: 'Your manuscript has gone to peer reviewers',
    body: 'Congratulations — your manuscript has moved into the initial peer review stage. One of our peer reviewers is now reading your work for content, methodology, quality, and originality. Please look forward to their feedback; any required edits from our peer reviewers will be sent to you directly via email so you can revise accordingly.',
  },
  'editorial review': {
    headline: 'Your manuscript is with a section editor',
    body: 'Your manuscript has passed the initial peer review and is now with a section editor who has expertise in your field. The editor is reviewing the larger structure, content, and formatting of your paper. Required edits will be emailed to you once this review is complete.',
  },
  'waiting for edits': {
    headline: 'Edits are required on your manuscript',
    body: 'Our editorial team has reviewed your manuscript and is requesting revisions. Please make the requested changes and upload your revised Microsoft Word file to your submission tracker. We cannot move your paper forward until the revised file is received.',
  },
  'secondary review': {
    headline: 'Your revised manuscript is in secondary review',
    body: 'Thank you for returning your revised manuscript. Our section editors are now reviewing your updated paper for grammar, structure, clarity, and final content changes. You may receive another small round of edits, or your manuscript may move forward to the publishing stage.',
  },
  publishing: {
    headline: 'Your manuscript is being prepared for publication',
    body: 'Your manuscript has cleared review and is now with our copy editor for final grammar, formatting, and polishing. Any remaining minor edits will be sent to you before the paper is published.',
  },
  published: {
    headline: 'Your manuscript has been published',
    body: 'Congratulations — your manuscript has been published in the National Youth Research Journal and is now publicly available in our archive. Thank you for sharing your research with us.',
  },
}

const DECISION_COPY: Record<string, Copy> = {
  accepted: {
    headline: 'Congratulations — your manuscript has been accepted',
    body: 'Congratulations! Your manuscript has been accepted to the National Youth Research Journal. Our editorial team will now prepare your paper for final publication, and any remaining formatting or copy edits will be sent to you before it goes live.',
  },
  declined: {
    headline: 'Unfortunately, your manuscript has been declined',
    body: 'Unfortunately, after careful review, our editors have decided not to move forward with your manuscript at this time. This is not a judgement of you as a researcher — you are welcome to revise your work and submit again to the National Youth Research Journal.',
  },
}

function resolveCopy(status: string, decision: string): Copy {
  const d = decision.trim().toLowerCase()
  if (d && d !== 'pending' && DECISION_COPY[d]) return DECISION_COPY[d]
  return (
    STATUS_COPY[status.trim().toLowerCase()] ?? {
      headline: 'Update on your submission',
      body: 'The status of your manuscript has been updated by our editorial team.',
    }
  )
}

export function SubmissionStatusEmail({
  title = 'your manuscript',
  status = 'initial review',
  decision = '',
  authorName = '',
  note = '',
}: SubmissionStatusProps) {
  const copy = resolveCopy(status, decision)
  return (
    <Html>
      <Head />
      <Preview>{copy.headline}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ padding: '32px 28px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '20px', margin: '0 0 16px', color: '#0f172a' }}>
            {copy.headline}
          </Heading>
          {authorName ? (
            <Text style={{ margin: '0 0 12px', fontSize: '15px', lineHeight: '1.6' }}>
              Dear {authorName},
            </Text>
          ) : null}
          <Text style={{ margin: '0 0 12px', fontSize: '15px', lineHeight: '1.6' }}>
            Regarding your submission <strong>{title}</strong>:
          </Text>
          <Text style={{ margin: '0 0 20px', fontSize: '15px', lineHeight: '1.6' }}>
            {copy.body}
          </Text>
          <Section
            style={{
              backgroundColor: '#f1f5f9',
              padding: '14px 16px',
              borderRadius: '6px',
              margin: '0 0 20px',
            }}
          >
            <Text style={{ margin: '0 0 4px', fontSize: '14px' }}>
              <strong>Current stage:</strong> {status}
            </Text>
            {decision && decision.trim().toLowerCase() !== 'pending' ? (
              <Text style={{ margin: 0, fontSize: '14px' }}>
                <strong>Decision:</strong> {decision}
              </Text>
            ) : null}
          </Section>
          {note && note.trim() ? (
            <Section
              style={{
                borderLeft: '3px solid #0f172a',
                padding: '4px 0 4px 14px',
                margin: '0 0 20px',
              }}
            >
              <Text style={{ margin: '0 0 6px', fontSize: '13px', color: '#475569' }}>
                <strong>A note from our editorial team</strong>
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: '15px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {note}
              </Text>
            </Section>
          ) : null}
          <Text style={{ margin: '0 0 20px', fontSize: '15px', lineHeight: '1.6' }}>
            You can follow your paper anytime on the submission tracker at nyrj.org/track.
          </Text>
          <Text style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
            National Youth Research Journal · Published in Atlanta, Georgia, USA · Reply to this email to
            reach our editorial team.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SubmissionStatusEmail,
  subject: (d: Record<string, any>) => {
    const decision = String(d['decision'] ?? '').trim().toLowerCase()
    if (decision === 'accepted') return 'NYRJ: your manuscript has been accepted'
    if (decision === 'declined') return 'NYRJ: decision on your manuscript'
    return `NYRJ submission update: ${d['status'] ?? 'status changed'}`
  },
  displayName: 'Submission status update (author)',
  previewData: {
    title: 'Photocatalytic Degradation of Microplastics',
    status: 'initial review',
    decision: '',
  },
} satisfies TemplateEntry
