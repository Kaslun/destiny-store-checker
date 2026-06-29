import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import webpush from "web-push";
import { dispatchNotifications } from "../lib/notify";

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const resend = new Resend(process.env.RESEND_API_KEY!);
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const result = await dispatchNotifications(db, {
    email: async (to, subject, html) => {
      await resend.emails.send({ from: process.env.NOTIFY_FROM_EMAIL!, to, subject, html });
    },
    push: async (subscription, payload) => {
      await webpush.sendNotification(subscription as webpush.PushSubscription, payload);
    },
  });

  console.log("notify-dispatch:", JSON.stringify(result));
}

main().catch((e) => {
  console.error("notify-dispatch FAILED:", e);
  process.exit(1);
});
