import { z } from "zod";

export const publicSubmissionSchema = z.object({
  formSlug: z.string().min(1).max(100),
  firstName: z.string().min(1).max(200),
  lastName: z.string().min(1).max(200),
  email: z.string().min(1).max(254),
  phone: z.string().max(100).optional(),
  lang: z.string().max(10).optional(),
  elapsedSeconds: z.number().optional(),
  // Custom field values keyed by FormField.key, e.g. { country: "Italy", service: "register-company" }
  fields: z.record(z.string(), z.unknown()).optional(),
  meta: z
    .object({
      referrer: z.string().max(2000).optional(),
      pageUrl: z.string().max(2000).optional(),
      utmSource: z.string().max(200).optional(),
      utmMedium: z.string().max(200).optional(),
      utmCampaign: z.string().max(200).optional(),
      userAgent: z.string().max(500).optional()
    })
    .optional()
});

export type PublicSubmissionPayload = z.infer<typeof publicSubmissionSchema>;
