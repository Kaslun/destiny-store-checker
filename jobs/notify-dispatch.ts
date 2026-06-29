import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import webpush from "web-push";
import { dispatchNotifications } from "../lib/notify";

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Configure channels lazily: a missing RESEND_API_KEY or VAPID set should not
  // crash the job. dispatchNotifications only calls a sender when a user has that
  // channel enabled, so with no config and no subscribers this runs clean.
  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;

  const vapidReady = Boolean(
    process.env.VAPID_SUBJECT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
  if (vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  }

  if (!resend && !vapidReady) {
    console.log("notify-dispatch: no email or web push configured; nothing to send.");
  }

  const result = await dispatchNotifications(db, {
    email: async (to, subject, html) => {
      if (!resend) throw new Error("RESEND_API_KEY not set; email channel disabled");
      await resend.emails.send({ from: process.env.NOTIFY_FROM_EMAIL!, to, subject, html });
    },
    push: async (subscription, payload) => {
      if (!vapidReady) throw new Error("VAPID keys not set; web push disabled");
      await webpush.sendNotification(subscription as webpush.PushSubscription, payload);
    },
  });

  console.log("notify-dispatch:", JSON.stringify(result));
}

main().catch((e) => {
  console.error("notify-dispatch FAILED:", e);
  process.exit(1);
});
