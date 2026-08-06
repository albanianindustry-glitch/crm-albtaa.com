import {
  createReminder,
  getDueReminders,
  markReminderSent
} from "@/domain/reminders/repository";
import { sendTemplatedEmail } from "@/domain/email/service";
import { logActivity } from "@/domain/activity/service";

export async function scheduleReminder(
  businessId: string,
  submissionId: string,
  triggerKey: string,
  scheduledFor: Date,
  actorId?: string
) {
  const reminder = await createReminder({ businessId, submissionId, triggerKey, scheduledFor });

  await logActivity({
    businessId,
    submissionId,
    type: "reminder.scheduled",
    payload: { reminderId: reminder.id, triggerKey, scheduledFor: scheduledFor.toISOString() },
    actorType: actorId ? "STAFF" : "SYSTEM",
    actorId
  });

  return reminder;
}

/**
 * Called by the Vercel Cron-triggered endpoint. Finds every Reminder
 * due (scheduledFor <= now, not sent, not cancelled), sends the
 * associated EmailTemplate (matched by triggerKey), logs the send,
 * and marks it sent. Each reminder is processed independently so one
 * failure doesn't block the rest of the batch.
 */
export async function processDueReminders(): Promise<{ processed: number; failed: number }> {
  const due = await getDueReminders(new Date());
  let processed = 0;
  let failed = 0;

  for (const reminder of due) {
    try {
      await sendTemplatedEmail({
        business: reminder.business,
        triggerKey: reminder.triggerKey,
        toEmail: reminder.submission.contact.email,
        contactId: reminder.submission.contactId,
        submissionId: reminder.submissionId,
        variables: {
          firstName: reminder.submission.contact.firstName,
          lastName: reminder.submission.contact.lastName,
          stageLabel: reminder.submission.currentStage?.label ?? ""
        }
      });

      await markReminderSent(reminder.id);

      await logActivity({
        businessId: reminder.businessId,
        submissionId: reminder.submissionId,
        type: "reminder.sent",
        payload: { reminderId: reminder.id, triggerKey: reminder.triggerKey },
        actorType: "SYSTEM"
      });

      processed++;
    } catch (err) {
      failed++;
      await logActivity({
        businessId: reminder.businessId,
        submissionId: reminder.submissionId,
        type: "reminder.failed",
        payload: {
          reminderId: reminder.id,
          triggerKey: reminder.triggerKey,
          error: err instanceof Error ? err.message : String(err)
        },
        actorType: "SYSTEM"
      }).catch(() => {});
    }
  }

  return { processed, failed };
}
