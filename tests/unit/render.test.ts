import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/email/render";

describe("renderTemplate", () => {
  it("substitutes a simple variable", () => {
    expect(renderTemplate("Hi {{firstName}}", { firstName: "Marco" })).toBe("Hi Marco");
  });

  it("substitutes nested paths", () => {
    expect(renderTemplate("{{contact.email}}", { contact: { email: "a@b.com" } })).toBe("a@b.com");
  });

  it("replaces missing variables with an empty string", () => {
    expect(renderTemplate("Hi {{unknown}}!", {})).toBe("Hi !");
  });

  it("leaves non-template text untouched", () => {
    expect(renderTemplate("Plain text, no vars.", {})).toBe("Plain text, no vars.");
  });

  it("handles multiple occurrences of the same variable", () => {
    expect(renderTemplate("{{name}} and {{name}} again", { name: "X" })).toBe("X and X again");
  });
});
