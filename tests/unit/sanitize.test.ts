import { describe, it, expect } from "vitest";
import { cleanString, isValidEmail } from "@/lib/sanitize";

describe("cleanString", () => {
  it("trims whitespace", () => {
    expect(cleanString("  hello  ")).toBe("hello");
  });

  it("unescapes basic HTML entities", () => {
    expect(cleanString("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(cleanString("&lt;b&gt;")).toBe("<b>");
  });

  it("strips control characters", () => {
    expect(cleanString("hello\x00world\x1F")).toBe("helloworld");
  });

  it("caps length", () => {
    const long = "a".repeat(3000);
    expect(cleanString(long, 10)).toHaveLength(10);
  });

  it("returns empty string for null/undefined", () => {
    expect(cleanString(null)).toBe("");
    expect(cleanString(undefined)).toBe("");
  });

  it("coerces non-string values", () => {
    expect(cleanString(123)).toBe("123");
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("marco.rossi@example.com")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
  });

  it("rejects overly long emails", () => {
    const long = "a".repeat(250) + "@example.com";
    expect(isValidEmail(long)).toBe(false);
  });
});
