"use client";
// Calm reconnect prompt; tokens expired, not a crash (doc 03 §6 / doc 04 §5).
export function ReconnectPrompt() {
  return (
    <div className="notice warn" role="status" style={{ marginBottom: "16px" }}>
      <strong>Reconnect your Bungie account.</strong>
      <p className="dim" style={{ margin: "4px 0 12px" }}>
        Your Bungie session expired, so owned/missing badges and affordability are paused.
        The store and catalog still work.
      </p>
      <a className="btn" href="/api/auth/login">Reconnect</a>
    </div>
  );
}
