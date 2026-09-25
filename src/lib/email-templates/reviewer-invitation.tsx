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

export interface ReviewerInvitationProps {
  reviewerName?: string
  title?: string
  researchDomain?: string
  keywords?: string
  dueDate?: string
  inviteUrl?: string
  files?: { filename: string; url: string; description: string }[]
}

export function ReviewerInvitationEmail({
  reviewerName = 'Reviewer',
  title = 'a manuscript',
  researchDomain = '',
  keywords = '',
  dueDate = '',
  inviteUrl = 'https://nyrj.org/review',
  files = [],
}: ReviewerInvitationProps) {
  return (
    <Html>
      <Head />
      <Preview>Invitation to review a manuscript for the National Youth Research Journal</Preview>
      <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Georgia, serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '600px' }}>
          <Heading style={{ fontSize: '22px', margin: '0 0 16px' }}>
            Invitation to review a manuscript
          </Heading>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>Dear {reviewerName},</Text>
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            On behalf of the editorial team of the National Youth Research Journal, we would be
            honoured if you would consider reviewing the following manuscript. Your expertise
            would be genuinely valuable to us, and we are grateful for any time you can offer.
          </Text>
          <Text style={{ fontSize: '16px', margin: '16px 0 4px' }}>
            <strong>Title:</strong> {title}
          </Text>
          {researchDomain ? (
            <Text style={{ fontSize: '15px', margin: '4px 0' }}>
              <strong>Domain:</strong> {researchDomain}
            </Text>
          ) : null}
          {keywords ? (
            <Text style={{ fontSize: '15px', margin: '4px 0' }}>
              <strong>Keywords:</strong> {keywords}
            </Text>
          ) : null}
          <Text style={{ fontSize: '16px', margin: '16px 0 8px' }}>
            If you accept, we kindly ask that your review be returned by{' '}
            <strong>{dueDate}</strong> (15 days from today). If you are unable to take this on,
            simply decline — we completely understand, and it helps us find a reviewer quickly.
          </Text>
          <Button
            href={inviteUrl}
            style={{
              backgroundColor: '#12263f',
              color: '#ffffff',
              padding: '12px 22px',
              fontSize: '14px',
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '12px',
            }}
          >
            Accept or decline this invitation
          </Button>
          <Text style={{ fontSize: '13px', color: '#666', marginTop: '16px' }}>
            Or paste this link into your browser: {inviteUrl}
          </Text>
          {files.length > 0 ? (
            <>
              <Text style={{ fontSize: '16px', margin: '20px 0 4px' }}>
                <strong>Manuscript files</strong> (also attached to this email where size allows;
                links stay active for 30 days):
              </Text>
              {files.map((f, i) => (
                <Text key={i} style={{ fontSize: '15px', margin: '4px 0' }}>
                  {f.description}:{' '}
                  <a href={f.url} style={{ color: '#12263f' }}>
                    {f.filename}
                  </a>
                </Text>
              ))}
            </>
          ) : null}
          <Text style={{ fontSize: '16px', margin: '16px 0 8px' }}>
            With sincere thanks,
            <br />
            The Editorial Team
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
  component: ReviewerInvitationEmail,
  subject: 'Invitation to review a manuscript — National Youth Research Journal',
  displayName: 'Peer reviewer invitation',
  previewData: {
    reviewerName: 'Dr. Rao',
    title: 'Photocatalytic Degradation of Microplastics',
    researchDomain: 'Environmental Science',
    keywords: 'microplastics, photocatalysis',
    dueDate: 'March 3, 2026',
    inviteUrl: 'https://nyrj.org/review?token=abc',
  },
} satisfies TemplateEntry
