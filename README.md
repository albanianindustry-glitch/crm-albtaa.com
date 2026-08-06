# Platform

Internal multi-business CRM / client-portal platform. Owns lead capture,
CRM, client onboarding (no-login secure links), document uploads, email
automation, tasks, and a timeline — reusable across every business you
own (currently ALBTAA fully configured, LumineDent seeded as a second
reference business).

The public marketing website(s) for each business are **separate
projects** and talk to this platform only through the versioned public
API (`POST /api/v1/public/submissions`, authenticated by a per-business
API key). Rebuilding a website never requires touching this repo.

## Architecture

```
Route handler → Service (business logic) → Repository (DB access) → Prisma
```

- Every business-scoped repository function takes `businessId` as its
  required first argument (the two documented exceptions —
  `getSubmissionBusinessId`, `getAutomationRuleBusinessId`,
  `getTaskBusinessId` — exist only because `/resource/:id` URLs don't
  carry a business slug; they return *only* an id, which the caller
  then uses for an access check before any other query runs).
- Every meaningful write appends to `ActivityLog` (submission created,
  stage changed, note/task added, document uploaded/reviewed, email
  sent/failed, reminder scheduled/sent/failed, automation rule
  created/updated/deleted). This is the single source for the
  Timeline UI — nothing is backfilled.
- `AutomationRule` (event → conditions → action) is the one integration
  point between submissions, documents, and stage changes on one side,
  and email/task/stage-move side effects on the other. Nothing calls
  Resend or moves a stage directly outside this engine except the
  manual staff actions in the CRM UI (which also log to ActivityLog).
- Multi-business isolation is `businessId`-scoped rows, not
  schema-per-tenant or Postgres RLS — see the architecture discussion
  in project history for the reasoning (internal tool, not
  multi-customer SaaS, so the isolation bar is "structurally hard to
  get wrong in application code," not "enforced by the database against
  an untrusted tenant").

## Local setup

```bash
npm install
cp .env.example .env   # fill in real values
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

The seed script prints ALBTAA's API key and the owner staff login —
save the API key immediately, it is only ever shown once (only the
hash is stored).

## Testing

```bash
npm run test          # unit tests — no DB required
DATABASE_URL="postgresql://...test_db" npm run test   # + integration tests
```

Unit tests cover sanitization, template rendering, and automation
condition evaluation. The integration suite
(`tests/integration/submissionFlow.test.ts`) exercises the complete
public submission flow against a real Postgres database: Contact
dedup, required-field validation, the bot time-trap, and
ActivityLog assertions. It auto-skips if `DATABASE_URL` isn't set, so
`npm test` stays usable without a database present.

> **Sandbox note (this build environment only):** Prisma's CLI
> (`generate`/`migrate`) downloads its query-engine binary from
> `binaries.prisma.sh`, which this particular sandbox's network
> allowlist blocks. Everything was still validated as far as possible
> here — a real local Postgres 16 was installed and is running, every
> Prisma relation was hand-reviewed for consistency, and `tsc --noEmit`
> was run repeatedly to catch real bugs (all real implicit-`any` and
> logic issues found this way were fixed; the only remaining `tsc`
> errors are the expected cascade from the stub `@prisma/client` having
> no generated types — confirmed by isolating one and reproducing the
> exact mechanism). In a normal environment, `npx prisma generate` and
> `npx prisma migrate dev` will simply work, and the 19 unit tests plus
> the full integration suite should all pass unmodified.

## Deployment

- **Database:** Supabase Postgres. Use the pooled connection string
  for `DATABASE_URL` in Vercel (serverless functions need pooling).
- **Storage:** a Supabase Storage bucket (default name `documents`,
  see `SUPABASE_DOCUMENTS_BUCKET`) for uploaded documents. Keep it
  **private** — the app only ever hands out short-lived signed URLs,
  never public links.
- **Email:** Resend, with a verified sending domain.
- **Cron:** `vercel.json` schedules `/api/v1/cron/reminders` every 15
  minutes. Set `CRON_SECRET` — Vercel sends it automatically as a
  Bearer token for cron-triggered requests.
- **Migrations:** run `npx prisma migrate deploy` as part of your
  deploy pipeline (not `migrate dev`, which is interactive/dev-only).

## Onboarding a new business (the Phase 8 validation target)

No code changes — everything below is data, added via `prisma/seed.ts`
or the settings UI:

1. `Business` row (name, slug, allowed origins, API key, branding).
2. `Pipeline` + `PipelineStage`s matching that business's process.
3. `DocumentType`s it needs.
4. `Form` + `FormVersion` + `FormField`s for each of its forms.
5. `EmailTemplate`s in its own voice.
6. `AutomationRule`s wiring events to those templates/stages/tasks.
7. That business's website posts to `/api/v1/public/submissions` with
   its own API key — same endpoint every business uses.

LumineDent in `prisma/seed.ts` is exactly this: a genuinely different
pipeline shape (patient journey vs. company registration), different
document types (insurance card / medical history vs. passport / POA),
its own form, its own email voice, and its own automation rules
(including a `MOVE_STAGE` and a `CREATE_TASK` rule — action types
ALBTAA's seed data doesn't otherwise exercise) — added with zero
changes to any file under `src/`.

## Status

All 8 roadmap phases are implemented: Foundation, Lead Capture, CRM,
Client Portal, Documents, Email Automation, Tasks & Timeline, and
Advanced Automation (conditional rule builder). See inline comments
throughout `src/domain/` for which phase introduced each piece.
