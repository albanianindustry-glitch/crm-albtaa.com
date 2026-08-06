import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient, FormFieldType } from "@prisma/client";
import { createSubmissionFromPublicForm } from "@/domain/submissions/service";
import { generateApiKey } from "@/lib/crypto";

/**
 * This test hits a real Postgres database via DATABASE_URL — it is
 * not mocked, because the behavior under test (transactional
 * Contact+Submission+ActivityLog creation, spam/rate-limit gating,
 * form-field validation) is precisely the part that a mocked Prisma
 * client would not meaningfully exercise.
 *
 * Run against a disposable test database:
 *   DATABASE_URL="postgresql://...test_db" npm run test
 *
 * If DATABASE_URL is not set, or the DB is unreachable, the suite
 * skips instead of failing the run — this keeps `npm test` usable in
 * environments without a live database (e.g. this sandbox) without
 * masking real failures when a DB is present.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

describeIfDb("submission flow (integration)", () => {
  const prisma = new PrismaClient();
  let businessId: string;

  beforeAll(async () => {
    try {
      await prisma.$connect();
    } catch {
      // Let the individual tests fail with a clear DB-connection
      // error rather than silently skipping when a URL was provided
      // but is not actually reachable.
    }

    const { hash } = generateApiKey();
    const business = await prisma.business.create({
      data: {
        name: "Test Business",
        slug: `test-biz-${Date.now()}`,
        allowedOrigins: [],
        apiKeyHash: hash,
        notificationEmail: "internal@test.example",
        branding: {}
      }
    });
    businessId = business.id;

    const pipeline = await prisma.pipeline.create({
      data: {
        businessId,
        name: "Default",
        isDefault: true,
        stages: {
          create: [{ businessId, key: "new_lead", label: "New Lead", order: 1 }]
        }
      }
    });

    await prisma.form.create({
      data: {
        businessId,
        slug: "contact",
        name: "Contact",
        versions: {
          create: {
            versionNumber: 1,
            fields: {
              create: [
                { key: "country", label: "Country", type: FormFieldType.TEXT, order: 1, required: true },
                { key: "message", label: "Message", type: FormFieldType.TEXTAREA, order: 2, required: false }
              ]
            }
          }
        }
      }
    });

    void pipeline;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { businessId } });
    await prisma.submission.deleteMany({ where: { businessId } });
    await prisma.contact.deleteMany({ where: { businessId } });
    await prisma.formField.deleteMany({ where: { formVersion: { form: { businessId } } } });
    await prisma.formVersion.deleteMany({ where: { form: { businessId } } });
    await prisma.form.deleteMany({ where: { businessId } });
    await prisma.pipelineStage.deleteMany({ where: { businessId } });
    await prisma.pipeline.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.$disconnect();
  });

  async function getBusiness() {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    return business;
  }

  it("rejects a payload missing required fields", async () => {
    const business = await getBusiness();
    const result = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "",
      lastName: "Rossi",
      email: "marco@example.com"
    } as any);

    expect(result.status).toBe("validation_error");
  });

  it("rejects an invalid email format", async () => {
    const business = await getBusiness();
    const result = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "Marco",
      lastName: "Rossi",
      email: "not-an-email"
    } as any);

    expect(result.status).toBe("validation_error");
  });

  it("rejects when a required custom field is missing", async () => {
    const business = await getBusiness();
    const result = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "Marco",
      lastName: "Rossi",
      email: `marco+${Date.now()}@example.com`,
      fields: {} // "country" is required and missing
    } as any);

    expect(result.status).toBe("validation_error");
  });

  it("creates a Contact + Submission + ActivityLog on a valid submission", async () => {
    const business = await getBusiness();
    const email = `marco+${Date.now()}@example.com`;

    const result = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "Marco",
      lastName: "Rossi",
      email,
      fields: { country: "Italy", message: "Interested in company registration." }
    } as any);

    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    const submission = await prisma.submission.findUnique({
      where: { id: result.submissionId },
      include: { contact: true }
    });
    expect(submission).not.toBeNull();
    expect(submission?.contact.email).toBe(email);
    expect((submission?.customFields as any).country).toBe("Italy");
    expect(submission?.currentStageId).not.toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: { submissionId: result.submissionId, type: "submission.created" }
    });
    expect(activity).not.toBeNull();
  });

  it("reuses the same Contact across two submissions from the same email", async () => {
    const business = await getBusiness();
    const email = `marco+${Date.now()}@example.com`;

    const first = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "Marco",
      lastName: "Rossi",
      email,
      fields: { country: "Italy" }
    } as any);
    expect(first.status).toBe("created");

    // Wait past the 3-second bot-trap window used by the spam check
    // isn't necessary here since elapsedSeconds is undefined (only
    // enforced when explicitly provided by the caller).
    const second = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "Marco",
      lastName: "Rossi",
      email,
      fields: { country: "Italy" }
    } as any);
    expect(second.status).toBe("created");
    if (first.status !== "created" || second.status !== "created") return;

    const [s1, s2] = await Promise.all([
      prisma.submission.findUnique({ where: { id: first.submissionId } }),
      prisma.submission.findUnique({ where: { id: second.submissionId } })
    ]);
    expect(s1?.contactId).toBe(s2?.contactId);
  });

  it("silently blocks a submission using the bot time-trap without creating a record", async () => {
    const business = await getBusiness();
    const email = `marco+${Date.now()}@example.com`;

    const result = await createSubmissionFromPublicForm(business, {
      formSlug: "contact",
      firstName: "Marco",
      lastName: "Rossi",
      email,
      elapsedSeconds: 1, // below the 3-second minimum
      fields: { country: "Italy" }
    } as any);

    expect(result.status).toBe("spam");

    const contact = await prisma.contact.findUnique({
      where: { businessId_email: { businessId, email } }
    });
    expect(contact).toBeNull();

    const spamLog = await prisma.activityLog.findFirst({
      where: { businessId, type: "submission.spam_blocked" }
    });
    expect(spamLog).not.toBeNull();
  });

  it("rejects submissions to an unknown form slug", async () => {
    const business = await getBusiness();
    const result = await createSubmissionFromPublicForm(business, {
      formSlug: "does-not-exist",
      firstName: "Marco",
      lastName: "Rossi",
      email: `marco+${Date.now()}@example.com`
    } as any);

    expect(result.status).toBe("validation_error");
  });
});
