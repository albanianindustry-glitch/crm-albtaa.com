/**
 * Deliberately minimal: {{key}} / {{nested.key}} interpolation only —
 * no loops, no conditionals. EmailTemplate bodies are short
 * transactional notices, not a general templating use case, and
 * keeping this simple means non-technical edits (in the settings UI,
 * Phase 6) can't produce a broken template.
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = path
      .split(".")
      .reduce<unknown>((acc: any, key: string) => (acc == null ? undefined : acc[key]), variables);
    return value === undefined || value === null ? "" : String(value);
  });
}
