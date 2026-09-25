import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AuthorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Valid email required").max(255),
  institution: z.string().trim().min(1, "Institution is required").max(255),
  orcid: z
    .string()
    .trim()
    .min(1, "ORCID is required")
    .max(50)
    .refine(
      (v) => /^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(v),
      "ORCID must look like 0000-0002-1825-0097",
    ),

  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(30)
    .refine(
      (v) => /^\+\d{1,4}[\d\s().-]{5,20}$/.test(v),
      "Include the country code, e.g. +1 404 555 0199",
    ),
  address: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().min(1, "State/Region is required").max(120),
  zip: z.string().trim().min(1, "ZIP/Postal is required").max(30),
  nation: z.string().trim().min(1, "Nation is required").max(120),
  institutionAddress: z.string().trim().min(1, "Institution address is required").max(500),
});

const FileRefSchema = z.object({
  path: z.string(),
  filename: z.string(),
  description: z.string().trim().max(500).optional().default(""),
});
const AdditionalFileRefSchema = z.object({
  path: z.string(),
  filename: z.string(),
  description: z.string().trim().min(1, "Description required").max(500),
});

const SubmissionSchema = z.object({
  title: z.string().trim().min(3).max(500),
  abstract: z.string().trim().max(8000).optional().default(""),
  researchType: z
    .enum([
      "Research Paper",
      "Perspective",
      "Review",
      "Theoretical Model",
      "Meta-analysis",
      "Other",
    ]),
  researchTypeOther: z.string().trim().max(200).optional().default(""),
  keywords: z.string().trim().min(1, "Keywords are required").max(300),
  researchDomain: z.string().trim().min(1, "Research domain is required").max(200),
  referralCode: z.string().trim().min(1, "Referral code is required").max(60),
  comments: z.string().trim().max(4000).optional().default(""),
  authors: z.array(AuthorSchema).min(1).max(20),
  conflictOfInterest: z.boolean(),
  conflictExplanation: z.string().trim().max(2000).optional().default(""),
  funding: z.boolean(),
  fundingSource: z.string().trim().max(500).optional().default(""),
  usedGenAi: z.boolean(),
  genAiExplanation: z.string().trim().max(2000).optional().default(""),
  isOriginal: z.boolean(),
  notUnderConsideration: z.boolean(),
  hasHumanOrVertebrate: z.boolean(),
  consentFormPaths: z.array(FileRefSchema).max(20).optional().default([]),
  dataAvailability: z.enum([
    "openly_available_online",
    "available_on_request",
    "not_available",
  ]),
  allAuthorsConsent: z.literal(true),
  manuscriptPath: z.string().trim().max(500).optional().default(""),
  manuscriptFilename: z.string().trim().max(255).optional().default(""),
  supplementaryPaths: z.array(AdditionalFileRefSchema).max(20).optional().default([]),
});

export type ManuscriptSubmissionInput = z.infer<typeof SubmissionSchema>;

export const submitManuscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmissionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims.email as string | undefined) ?? "";
    if (!email) throw new Error("No email on account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("manuscript_submissions")
      .insert({
        submitter_email: email.toLowerCase(),
        title: data.title,
        abstract: data.abstract,
        research_type: data.researchType,
        research_type_other: data.researchTypeOther,
        keywords: data.keywords,
        research_domain: data.researchDomain,
        referral_code: data.referralCode,
        comments: data.comments,
        authors: data.authors,
        conflict_of_interest: data.conflictOfInterest,
        conflict_explanation: data.conflictExplanation,
        funding: data.funding,
        funding_source: data.fundingSource,
        used_gen_ai: data.usedGenAi,
        gen_ai_explanation: data.genAiExplanation,
        is_original: data.isOriginal,
        not_under_consideration: data.notUnderConsideration,
        has_human_or_vertebrate: data.hasHumanOrVertebrate,
        consent_form_paths: data.consentFormPaths,
        data_availability: data.dataAvailability,
        all_authors_consent: data.allAuthorsConsent,
        manuscript_path: data.manuscriptPath,
        manuscript_filename: data.manuscriptFilename,
        supplementary_paths: data.supplementaryPaths,
        status: "submitted",
      } as never)
      .select("id")
      .single();

    if (error) {
      console.error("[server] submitManuscript error:", error);
      throw new Error("Failed to save submission. Please try again.");
    }

    // Mirror into the OneDrive submissions workbook (reviewer filled in below).
    try {
      const { appendSubmissionRow } = await import("./excel-sync.server");
      await appendSubmissionRow({
        submittedAt: new Date().toISOString(),
        submissionId: row.id as string,
        title: data.title,
        submitterEmail: email.toLowerCase(),
        authors: data.authors.map((a) => a.name).join("; "),
        orcids: data.authors.map((a) => a.orcid).join("; "),
        researchType:
          data.researchType === "Other" ? `Other: ${data.researchTypeOther}` : data.researchType,
        status: "submitted",
        decision: "pending",
        reviewer: "",
      });
    } catch (e) {
      console.error("[server] excel sync failed:", e);
    }

    // Assign an initial reviewer from the rotation, email them, sync the sheet.
    try {
      const { assignInitialReviewer } = await import("./initial-reviewers.server");
      await assignInitialReviewer(row.id as string, data.title);
    } catch (e) {
      console.error("[server] initial reviewer assignment failed:", e);
    }

    // Notify the editorial team (managed email). Never block the submission.
    const editorEmails = ["keyaanmerchant24@gmail.com", "Madhavarora529@gmail.com"];
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await Promise.all(
        editorEmails.map((recipient) =>
          sendTemplateEmail("manuscript-submission", recipient, {
            idempotencyKey: `manuscript-submission-${row.id}-${recipient}`,
            replyTo: email,
            templateData: {
              submitterEmail: email,
              title: data.title,
              submissionId: row.id,
            },
          }).catch((e) =>
            console.error(`[server] submission notification to ${recipient} failed:`, e),
          ),
        ),
      );
    } catch (e) {
      console.error("[server] submission notification emails failed:", e);
    }

    // Send confirmation to the submitter that their paper was received.
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("submission-confirmation", email, {
        idempotencyKey: `submission-confirmation-${row.id}`,
        templateData: {
          submitterName: data.authors[0]?.name ?? "there",
          title: data.title,
          submissionId: row.id,
        },
      });
    } catch (e) {
      console.error("[server] submitter confirmation email failed:", e);
    }

    return { id: row.id as string };
  });
