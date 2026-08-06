type ConditionValue =
  | string
  | number
  | boolean
  | { eq?: unknown; gte?: number; lte?: number; gt?: number; lt?: number };

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc: any, key) => (acc == null ? undefined : acc[key]), obj);
}

/**
 * Conditions is a flat map of dot-path -> expected value (equality)
 * or a small comparison object ({ gte, lte, gt, lt, eq }). This is
 * intentionally not a general expression language — see the frozen
 * architecture decision on AutomationRule: it covers "event X where
 * field Y compares to Z" and nothing more elaborate, which is enough
 * for reminder/follow-up style rules without building a DSL.
 */
export function evaluateConditions(
  conditions: Record<string, ConditionValue>,
  context: Record<string, unknown>
): boolean {
  const entries = Object.entries(conditions ?? {});
  if (entries.length === 0) return true; // no conditions = always match

  return entries.every(([path, expected]) => {
    const actual = getPath(context, path);

    if (expected !== null && typeof expected === "object" && !Array.isArray(expected)) {
      const cmp = expected as { eq?: unknown; gte?: number; lte?: number; gt?: number; lt?: number };
      if (cmp.eq !== undefined && actual !== cmp.eq) return false;
      if (cmp.gte !== undefined && !(typeof actual === "number" && actual >= cmp.gte)) return false;
      if (cmp.lte !== undefined && !(typeof actual === "number" && actual <= cmp.lte)) return false;
      if (cmp.gt !== undefined && !(typeof actual === "number" && actual > cmp.gt)) return false;
      if (cmp.lt !== undefined && !(typeof actual === "number" && actual < cmp.lt)) return false;
      return true;
    }

    return actual === expected;
  });
}
