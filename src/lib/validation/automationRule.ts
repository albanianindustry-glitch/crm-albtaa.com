import { z } from "zod";
import { AutomationActionType } from "@prisma/client";

export const conditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({
    eq: z.unknown().optional(),
    gte: z.number().optional(),
    lte: z.number().optional(),
    gt: z.number().optional(),
    lt: z.number().optional()
  })
]);

/** Full schema for creating a rule (POST). */
export const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  eventTrigger: z.string().min(1).max(200),
  conditions: z.record(z.string(), conditionValueSchema).default({}),
  actionType: z.nativeEnum(AutomationActionType),
  actionConfig: z.record(z.string(), z.unknown()),
  isActive: z.boolean().default(true)
});

/** Partial schema for editing a rule (PATCH) — every field optional. */
export const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  eventTrigger: z.string().min(1).max(200).optional(),
  conditions: z.record(z.string(), conditionValueSchema).optional(),
  actionType: z.nativeEnum(AutomationActionType).optional(),
  actionConfig: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional()
});
