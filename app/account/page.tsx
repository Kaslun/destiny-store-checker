"use client";
import { useEffect, useState } from "react";
import { useOverlay } from "@/components/OverlayProvider";
import { api } from "@/lib/api";
import { ReconnectPrompt } from "@/components/ReconnectPrompt";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function AccountPage() {
  const { auth, displayName, refresh } = useOverlay();
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [webPushEnabled, setWebPushEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (auth !== "logged_in") return;
    api.prefs().then((r) => {
      if (r.kind === "ok") { setEmailEnabled(r.data.emailEnabled); setEmail(r.data.email ?? ""); setWebPushEnabled(r.data.webPushEnabled); }
    });
  }, [auth]);

  if (auth === "loading") return <p className="dim">Loading…</p>;

  if (auth === "logged_out") {
    return (
      <>
        <h1 className="page-title">Account</h1>
        <div className="notice">
          <p>Log in with your Bungie account to see what you own, track affordability, and save a wishlist.</p>
          <a className="btn" href="/api/auth/login">Log in with Bungie</a>
        </div>
      </>
    );
  }

  async function savePrefs() {
    await api.savePrefs({ emailEnabled, email: email || null, webPushEnabled });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function enableWebPush() {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
    await fetch("/api/notifications/webpush/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    setWebPushEnabled(true);
  }

  return (
    <>
      <h1 className="page-title">Account</h1>
      {auth === "needs_reauth" && <ReconnectPrompt />}

      <div className="notice" style={{ marginBottom: 16 }}>
        <strong>Connected:</strong> {displayName}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn secondary" onClick={async () => { await api.logout(); refresh(); }}>Log out</button>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "var(--fs-title)", marginTop: 0 }}>Notifications</h2>
        <p className="dim" style={{ fontSize: "0.85rem" }}>Get told once when a wishlist item enters the rotation.</p>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
          Email me
        </label>
        <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
               aria-label="Notification email"
               style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                        background: "var(--surface-2)", color: "var(--text)", width: "100%", maxWidth: 320, marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button className="btn secondary" onClick={enableWebPush} disabled={webPushEnabled}>
            {webPushEnabled ? "Web push enabled" : "Enable web push"}
          </button>
        </div>
        <button className="btn" onClick={savePrefs}>Save preferences</button>
        {saved && <span className="dim" style={{ marginLeft: 12 }}>Saved.</span>}
      </div>

      <div className="notice">
        <h2 style={{ fontSize: "var(--fs-title)", marginTop: 0 }}>Delete account</h2>
        <p className="dim" style={{ fontSize: "0.85rem" }}>
          Removes your stored tokens, wishlist, notification preferences, and history log. This cannot be undone.
        </p>
        <button className="btn danger" onClick={async () => {
          if (confirm("Delete your Everywherse account and all associated data?")) {
            await api.deleteAccount(); refresh(); window.location.href = "/";
          }
        }}>Delete my account</button>
      </div>
    </>
  );
}
