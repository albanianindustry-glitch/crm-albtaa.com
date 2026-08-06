/**
 * Run with `npm run seed`. Idempotent-ish: uses upsert where the
 * natural key allows it, but form/pipeline field arrays are seeded
 * with delete+recreate for simplicity — safe pre-launch, replace
 * with proper upsert-per-row logic once real submission data exists
 * against these definitions (a FormVersion is meant to be immutable
 * once submissions reference it — editing a live form should create
 * FormVersion 2, not mutate version 1).
 */
import { PrismaClient, FormFieldType, AutomationActionType } from "@prisma/client";
import { hashPassword, generateApiKey } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function seedAlbtaa() {
  const { rawKey, hash } = generateApiKey();

  const business = await prisma.business.upsert({
    where: { slug: "albtaa" },
    update: {},
    create: {
      name: "ALBTAA",
      slug: "albtaa",
      allowedOrigins: ["https://albtaa.com", "https://www.albtaa.com"],
      apiKeyHash: hash,
      notificationEmail: "enejdsaliaj@eufin.al",
      branding: {
        senderName: "ALBTAA",
        senderEmail: "no-reply@albtaa.com",
        primaryColor: "#0e1b2e"
      }
    }
  });

  console.log(`\n[ALBTAA] API key (save this now, it will not be shown again):\n  ${rawKey}\n`);

  // ── Pipeline ────────────────────────────────────────────────
  const pipeline = await prisma.pipeline.create({
    data: {
      businessId: business.id,
      name: "Company Registration",
      isDefault: true,
      stages: {
        create: [
          { businessId: business.id, key: "new_lead", label: "New Lead", order: 1 },
          { businessId: business.id, key: "docs_pending", label: "Documents Pending", order: 2 },
          { businessId: business.id, key: "filed", label: "Filed", order: 3 },
          { businessId: business.id, key: "registered", label: "Registered", order: 4, isTerminal: true },
          { businessId: business.id, key: "closed", label: "Closed", order: 5, isTerminal: true }
        ]
      }
    }
  });

  // ── Document types ──────────────────────────────────────────
  await prisma.documentType.createMany({
    data: [
      { businessId: business.id, key: "passport", label: "Passport", isRequired: true },
      { businessId: business.id, key: "poa", label: "Power of Attorney", isRequired: true }
    ]
  });

  // ── Contact form ─────────────────────────────────────────────
  const contactForm = await prisma.form.create({
    data: {
      businessId: business.id,
      slug: "contact",
      name: "Contact Page",
      versions: {
        create: {
          versionNumber: 1,
          fields: {
            create: [
              { key: "country", label: "Country", type: FormFieldType.TEXT, order: 1, required: true },
              { key: "service", label: "Service Interested In", type: FormFieldType.SELECT, order: 2, required: false },
              { key: "message", label: "Message", type: FormFieldType.TEXTAREA, order: 3, required: false }
            ]
          }
        }
      }
    }
  });

  // ── Register-company form ───────────────────────────────────
  await prisma.form.create({
    data: {
      businessId: business.id,
      slug: "register-company-albania",
      name: "Register a Company — Full Form",
      versions: {
        create: {
          versionNumber: 1,
          fields: {
            create: [
              { key: "country", label: "Country", type: FormFieldType.TEXT, order: 1, required: true },
              { key: "service", label: "Service Interested In", type: FormFieldType.SELECT, order: 2, required: false },
              { key: "message", label: "Message", type: FormFieldType.TEXTAREA, order: 3, required: false }
            ]
          }
        }
      }
    }
  });

  // ── Email templates ─────────────────────────────────────────
  await prisma.emailTemplate.create({
    data: {
      businessId: business.id,
      triggerKey: "lead.internal_notification",
      subject: "{{firstName}} {{lastName}} — {{formLabel}} — albtaa.com",
      bodyHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a">
<p><strong>Name:</strong> {{firstName}} {{lastName}}</p>
<p><strong>Email:</strong> {{email}}</p>
<p><strong>Country:</strong> {{country}}</p>
<p><strong>Service:</strong> {{service}}</p>
<p><strong>Message:</strong><br/>{{message}}</p>
<p><strong>Form:</strong> {{formLabel}}</p>
</div>`,
      bodyText:
        "Name: {{firstName}} {{lastName}}\nEmail: {{email}}\nCountry: {{country}}\nService: {{service}}\nMessage: {{message}}\nForm: {{formLabel}}"
    }
  });

  await prisma.emailTemplate.create({
    data: {
      businessId: business.id,
      triggerKey: "lead.client_welcome",
      subject: "We've received your request — ALBTAA",
      bodyHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a">
<p>Hi {{firstName}},</p>
<p>Thank you for reaching out to ALBTAA. We've received your request and will be in touch shortly.</p>
<p>You can track the status of your request and upload any required documents here:</p>
<p><a href="{{portalLink}}">{{portalLink}}</a></p>
<p>This link is unique to you — no account or password needed.</p>
<p>— The ALBTAA Team</p>
</div>`,
      bodyText:
        "Hi {{firstName}},\n\nThank you for reaching out to ALBTAA. We've received your request and will be in touch shortly.\n\nTrack your request here: {{portalLink}}\n\nThis link is unique to you — no account or password needed.\n\n— The ALBTAA Team"
    }
  });

  // ── Automation rules: submission.created -> both emails ────
  await prisma.automationRule.createMany({
    data: [
      {
        businessId: business.id,
        name: "Notify staff on new lead",
        eventTrigger: "submission.created",
        conditions: {},
        actionType: AutomationActionType.SEND_EMAIL,
        actionConfig: { templateKey: "lead.internal_notification", recipient: "internal" }
      },
      {
        businessId: business.id,
        name: "Send client welcome + portal link",
        eventTrigger: "submission.created",
        conditions: {},
        actionType: AutomationActionType.SEND_EMAIL,
        actionConfig: { templateKey: "lead.client_welcome", recipient: "client" }
      }
    ]
  });

  return { business, pipeline, contactForm };
}

/**
 * LumineDent is seeded as a REFERENCE business only — enough real
 * structure (a genuinely different pipeline shape, different
 * document types, a different form) to prove the schema isn't
 * accidentally ALBTAA-shaped, per the approved roadmap. No website
 * integration, no email sending is expected to actually run against
 * it yet.
 */
async function seedLumineDent() {
  const { hash } = generateApiKey();

  const business = await prisma.business.upsert({
    where: { slug: "luminedent" },
    update: {},
    create: {
      name: "LumineDent",
      slug: "luminedent",
      allowedOrigins: ["https://luminedent.example"],
      apiKeyHash: hash,
      notificationEmail: "front-desk@luminedent.example",
      branding: {
        senderName: "LumineDent",
        senderEmail: "no-reply@luminedent.example",
        primaryColor: "#1f6f5c"
      }
    }
  });

  await prisma.pipeline.create({
    data: {
      businessId: business.id,
      name: "Patient Journey",
      isDefault: true,
      stages: {
        create: [
          { businessId: business.id, key: "inquiry", label: "Inquiry", order: 1 },
          { businessId: business.id, key: "consult_booked", label: "Consult Booked", order: 2 },
          { businessId: business.id, key: "treatment_plan", label: "Treatment Plan Sent", order: 3 },
          { businessId: business.id, key: "in_treatment", label: "In Treatment", order: 4 },
          { businessId: business.id, key: "completed", label: "Completed", order: 5, isTerminal: true }
        ]
      }
    }
  });

  await prisma.documentType.createMany({
    data: [
      { businessId: business.id, key: "insurance_card", label: "Insurance Card", isRequired: false },
      { businessId: business.id, key: "medical_history", label: "Medical History Form", isRequired: true }
    ]
  });

  await prisma.form.create({
    data: {
      businessId: business.id,
      slug: "book-consult",
      name: "Book a Consultation",
      versions: {
        create: {
          versionNumber: 1,
          fields: {
            create: [
              { key: "reasonForVisit", label: "Reason for Visit", type: FormFieldType.SELECT, order: 1, required: true },
              { key: "preferredDate", label: "Preferred Date", type: FormFieldType.TEXT, order: 2, required: false },
              { key: "notes", label: "Notes", type: FormFieldType.TEXTAREA, order: 3, required: false }
            ]
          }
        }
      }
    }
  });

  // ── Email templates — different voice/branding than ALBTAA,
  //    proving templates aren't hardcoded to one business's tone.
  await prisma.emailTemplate.create({
    data: {
      businessId: business.id,
      triggerKey: "lead.internal_notification",
      subject: "New inquiry: {{firstName}} {{lastName}} — LumineDent",
      bodyHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7">
<p><strong>Patient:</strong> {{firstName}} {{lastName}}</p>
<p><strong>Email:</strong> {{email}}</p>
<p><strong>Reason for visit:</strong> {{service}}</p>
<p><strong>Notes:</strong><br/>{{message}}</p>
</div>`,
      bodyText: "Patient: {{firstName}} {{lastName}}\nEmail: {{email}}\nReason: {{service}}\nNotes: {{message}}"
    }
  });

  await prisma.emailTemplate.create({
    data: {
      businessId: business.id,
      triggerKey: "lead.client_welcome",
      subject: "Thanks for reaching out to LumineDent",
      bodyHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7">
<p>Hi {{firstName}},</p>
<p>Thanks for reaching out! Our front desk will call you shortly to confirm a time.</p>
<p>You can check your appointment status and upload your insurance card here:</p>
<p><a href="{{portalLink}}">{{portalLink}}</a></p>
<p>— The LumineDent Team</p>
</div>`,
      bodyText:
        "Hi {{firstName}},\n\nThanks for reaching out! Our front desk will call you shortly to confirm a time.\n\nCheck your status here: {{portalLink}}\n\n— The LumineDent Team"
    }
  });

  await prisma.emailTemplate.create({
    data: {
      businessId: business.id,
      triggerKey: "reminder.missing_medical_history",
      subject: "Quick reminder — medical history form",
      bodyHtml: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7">
<p>Hi {{firstName}},</p>
<p>Just a friendly reminder to complete your medical history form before your visit.</p>
</div>`,
      bodyText: "Hi {{firstName}},\n\nJust a friendly reminder to complete your medical history form before your visit."
    }
  });

  // ── Automation rules — a genuinely different pipeline/action shape
  //    than ALBTAA (stage-move automation on consult booking, plus a
  //    document-triggered rule), seeded with ZERO platform code
  //    changes — this is the roadmap's Phase 8 validation target.
  const patientPipeline = await prisma.pipeline.findFirstOrThrow({ where: { businessId: business.id } });
  const consultBookedStage = await prisma.pipelineStage.findFirstOrThrow({
    where: { pipelineId: patientPipeline.id, key: "consult_booked" }
  });

  await prisma.automationRule.createMany({
    data: [
      {
        businessId: business.id,
        name: "Notify front desk on new inquiry",
        eventTrigger: "submission.created",
        conditions: {},
        actionType: AutomationActionType.SEND_EMAIL,
        actionConfig: { templateKey: "lead.internal_notification", recipient: "internal" }
      },
      {
        businessId: business.id,
        name: "Send patient welcome + portal link",
        eventTrigger: "submission.created",
        conditions: {},
        actionType: AutomationActionType.SEND_EMAIL,
        actionConfig: { templateKey: "lead.client_welcome", recipient: "client" }
      },
      {
        businessId: business.id,
        name: "Move to Consult Booked when a consult form is submitted",
        eventTrigger: "submission.created",
        conditions: { formSlug: "book-consult" },
        actionType: AutomationActionType.MOVE_STAGE,
        actionConfig: { stageKey: consultBookedStage.key }
      },
      {
        businessId: business.id,
        name: "Ask for medical history after document upload",
        eventTrigger: "document.uploaded",
        conditions: { documentTypeKey: "insurance_card" },
        actionType: AutomationActionType.CREATE_TASK,
        actionConfig: { title: "Confirm medical history form received", dueInDays: 2 }
      }
    ]
  });

  return { business };
}

async function seedStaff(businesses: { albtaaId: string; luminedentId: string }) {
  const email = process.env.SEED_OWNER_EMAIL || "owner@yourcompany.com";
  const rawPassword = process.env.SEED_OWNER_PASSWORD || "ChangeMe123!";
  const passwordHash = await hashPassword(rawPassword);

  await prisma.staffUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Owner",
      role: "OWNER"
      // businesses left empty => sees all businesses, per the
      // "small team, flat access" decision.
    }
  });

  console.log(`\n[STAFF] Owner login:\n  email: ${email}\n  password: ${rawPassword}\n  (change this after first login)\n`);
}

async function main() {
  const { business: albtaa } = await seedAlbtaa();
  const { business: luminedent } = await seedLumineDent();
  await seedStaff({ albtaaId: albtaa.id, luminedentId: luminedent.id });
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
