import { Business } from "@prisma/client";
import { getResendClient } from "@/lib/email/resend";
import { renderTemplate } from "@/lib/email/render";
import { getActiveEmailTemplate, createEmailLog, upsertEmailTemplate } from "@/domain/email/repository";
import { logActivity } from "@/domain/activity/service";

export interface SendTemplatedEmailInput {
  business: Business;
  triggerKey: string;
  toEmail: string;
  contactId: string;
  submissionId?: string;
  variables: Record<string, unknown>;
}

interface BusinessBranding {
  senderName?: string;
  senderEmail?: string;
  logoUrl?: string;
  primaryColor?: string;
}

/**
 * Looks up the business's EmailTemplate for `triggerKey`. If none is
 * configured (or it's inactive), this is a no-op — a business that
 * hasn't set up a template for a given event simply doesn't send one,
 * rather than failing the surrounding operation. Every send (or
 * skip-due-to-missing-template) never throws outward; email delivery
 * problems must never block the submission/document/stage-change
 * operation that triggered them.
 */
export async function sendTemplatedEmail(input: SendTemplatedEmailInput): Promise<void> {
  try {
    const template = await getActiveEmailTemplate(input.business.id, input.triggerKey);
    if (!template) return;

    const branding = (input.business.branding as BusinessBranding) ?? {};
    const senderName = branding.senderName || input.business.name;
    const senderEmail = branding.senderEmail || process.env.DEFAULT_SENDER_EMAIL;
    if (!senderEmail) {
      throw new Error(
        `No sender email configured for business ${input.business.slug} and no DEFAULT_SENDER_EMAIL fallback set.`
      );
    }

    const subject = renderTemplate(template.subject, input.variables);
    const html = renderTemplate(template.bodyHtml, input.variables);
    const text = renderTemplate(template.bodyText, input.variables);

    const resend = getResendClient();
    const result = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: input.toEmail,
      subject,
      html,
      text
    });

    await createEmailLog({
      businessId: input.business.id,
      contactId: input.contactId,
      triggerKey: input.triggerKey,
      toEmail: input.toEmail,
      subject,
      resendId: result.data?.id
    });

    await logActivity({
      businessId: input.business.id,
      submissionId: input.submissionId,
      type: "email.sent",
      payload: { triggerKey: input.triggerKey, toEmail: input.toEmail, subject },
      actorType: "SYSTEM"
    });
  } catch (err) {
    // Swallow: a failed notification email must never roll back or
    // fail the business operation that triggered it. Log for
    // visibility instead.
    await logActivity({
      businessId: input.business.id,
      submissionId: input.submissionId,
      type: "email.failed",
      payload: {
        triggerKey: input.triggerKey,
        toEmail: input.toEmail,
        error: err instanceof Error ? err.message : String(err)
      },
      actorType: "SYSTEM"
    }).catch(() => {
      /* if even the failure log fails, there's nothing further to do */
    });
  }
}

export interface SaveTemplateInput {
  businessId: string;
  triggerKey: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isActive: boolean;
  staffUserId: string;
}

/**
 * Config-level write (editing a template), not a submission event —
 * still logged, with submissionId omitted since it's business-scoped
 * rather than tied to one lead's history.
 */
export async function saveEmailTemplate(input: SaveTemplateInput) {
  const template = await upsertEmailTemplate({
    businessId: input.businessId,
    triggerKey: input.triggerKey,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    isActive: input.isActive
  });

  await logActivity({
    businessId: input.businessId,
    type: "email_template.saved",
    payload: { triggerKey: input.triggerKey, isActive: input.isActive },
    actorType: "STAFF",
    actorId: input.staffUserId
  });

  return template;
}
