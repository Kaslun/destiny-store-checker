export type ApiState<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthenticated" }
  | { kind: "needs_reauth" }
  | { kind: "error"; status: number };

async function call<T>(input: string, init?: RequestInit): Promise<ApiState<T>> {
  const res = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 401) return { kind: "unauthenticated" };
  if (res.status === 409) return { kind: "needs_reauth" };
  if (!res.ok) return { kind: "error", status: res.status };
  const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  return { kind: "ok", data };
}

export const api = {
  me: () => call<{ userId: string; displayName: string }>("/api/me"),
  collectibles: () => call<{ owned: number[]; missing: number[]; obscured: number[] }>("/api/me/collectibles"),
  currency: () => call<{ brightDust: number }>("/api/me/currency"),
  wishlist: () => call<{ items: { itemHash: number; notify: boolean; createdAt: string }[] }>("/api/wishlist"),
  addStar: (itemHash: number) =>
    call<{ itemHash: number; notify: boolean }>("/api/wishlist", { method: "POST", body: JSON.stringify({ itemHash }) }),
  removeStar: (itemHash: number) => call<void>(`/api/wishlist/${itemHash}`, { method: "DELETE" }),
  prefs: () => call<{ emailEnabled: boolean; email: string | null; webPushEnabled: boolean }>("/api/notifications/prefs"),
  savePrefs: (body: Record<string, unknown>) =>
    call<unknown>("/api/notifications/prefs", { method: "PUT", body: JSON.stringify(body) }),
  logout: () => call<void>("/api/auth/logout", { method: "POST" }),
  deleteAccount: () => call<void>("/api/account/delete", { method: "POST" }),
};
