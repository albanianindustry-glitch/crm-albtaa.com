import { describe, it, expect } from "vitest";
import { evaluateConditions } from "@/lib/conditions";

describe("evaluateConditions", () => {
  it("matches everything when conditions are empty", () => {
    expect(evaluateConditions({}, {})).toBe(true);
  });

  it("matches simple equality", () => {
    expect(evaluateConditions({ formSlug: "contact" }, { formSlug: "contact" })).toBe(true);
    expect(evaluateConditions({ formSlug: "contact" }, { formSlug: "other" })).toBe(false);
  });

  it("matches nested paths", () => {
    expect(
      evaluateConditions({ "stage.key": "docs_pending" }, { stage: { key: "docs_pending" } })
    ).toBe(true);
  });

  it("supports gte comparisons", () => {
    expect(evaluateConditions({ daysSinceStageChange: { gte: 5 } }, { daysSinceStageChange: 7 })).toBe(
      true
    );
    expect(evaluateConditions({ daysSinceStageChange: { gte: 5 } }, { daysSinceStageChange: 2 })).toBe(
      false
    );
  });

  it("requires all conditions to match (AND semantics)", () => {
    const conditions = { formSlug: "contact", "stage.key": "docs_pending" };
    expect(evaluateConditions(conditions, { formSlug: "contact", stage: { key: "docs_pending" } })).toBe(
      true
    );
    expect(evaluateConditions(conditions, { formSlug: "contact", stage: { key: "filed" } })).toBe(false);
  });
});
