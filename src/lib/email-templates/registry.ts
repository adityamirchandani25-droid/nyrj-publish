import type { ComponentType } from 'react'

import { template as manuscriptSubmissionTemplate } from './manuscript-submission'
import { template as submissionConfirmationTemplate } from './submission-confirmation'
import { template as eventIdeaTemplate } from './event-idea'
import { template as submissionStatusTemplate } from './submission-status'
import { template as reviewerInvitationTemplate } from './reviewer-invitation'
import { template as reviewReceivedTemplate } from './review-received'
import { template as authorEditsTemplate } from './author-edits'
import { template as reviewerAccountApprovedTemplate } from './reviewer-account-approved'
import { template as reviewerResponseTemplate } from './reviewer-response'
import { template as reviewerReminderTemplate } from './reviewer-reminder'
import { template as reviewThankYouTemplate } from './review-thank-you'
import { template as initialReviewAssignmentTemplate } from './initial-review-assignment'
import { template as reviewerPasswordResetTemplate } from './reviewer-password-reset'
import { template as editorAccountApprovedTemplate } from './editor-account-approved'
import { template as editorRecommendationTemplate } from './editor-recommendation'
import { template as authorRevisionRequestTemplate } from './author-revision-request'
import { template as revisionReceivedTemplate } from './revision-received'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'manuscript-submission': manuscriptSubmissionTemplate,
  'submission-confirmation': submissionConfirmationTemplate,
  'event-idea': eventIdeaTemplate,
  'submission-status': submissionStatusTemplate,
  'reviewer-invitation': reviewerInvitationTemplate,
  'review-received': reviewReceivedTemplate,
  'author-edits': authorEditsTemplate,
  'reviewer-account-approved': reviewerAccountApprovedTemplate,
  'reviewer-response': reviewerResponseTemplate,
  'reviewer-reminder': reviewerReminderTemplate,
  'review-thank-you': reviewThankYouTemplate,
  'initial-review-assignment': initialReviewAssignmentTemplate,
  'reviewer-password-reset': reviewerPasswordResetTemplate,
  'editor-account-approved': editorAccountApprovedTemplate,
  'editor-recommendation': editorRecommendationTemplate,
  'author-revision-request': authorRevisionRequestTemplate,
  'revision-received': revisionReceivedTemplate,
}
