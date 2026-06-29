"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

type Auth = "loading" | "logged_out" | "logged_in" | "needs_reauth";

type Ctx = {
  auth: Auth;
  displayName: string | null;
  owned: Set<number>;
  missing: Set<number>;
  obscured: Set<number>;
  brightDust: number;
  wishlist: Set<number>;
  toggleStar: (itemHash: number) => Promise<void>;
  refresh: () => void;
};

const OverlayCtx = createContext<Ctx | null>(null);
export const useOverlay = () => {
  const c = useContext(OverlayCtx);
  if (!c) throw new Error("useOverlay outside provider");
  return c;
};

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth>("loading");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [owned, setOwned] = useState<Set<number>>(new Set());
  const [missing, setMissing] = useState<Set<number>>(new Set());
  const [obscured, setObscured] = useState<Set<number>>(new Set());
  const [brightDust, setBrightDust] = useState(0);
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const me = await api.me();
    if (me.kind === "unauthenticated") { setAuth("logged_out"); return; }
    if (me.kind === "needs_reauth") { setAuth("needs_reauth"); return; }
    if (me.kind !== "ok") { setAuth("logged_out"); return; }
    setDisplayName(me.data.displayName);
    setAuth("logged_in");

    // Personal layers fill in after first paint; tolerate partial failure.
    const [col, cur, wl] = await Promise.all([api.collectibles(), api.currency(), api.wishlist()]);
    if (col.kind === "needs_reauth" || cur.kind === "needs_reauth") setAuth("needs_reauth");
    if (col.kind === "ok") { setOwned(new Set(col.data.owned)); setMissing(new Set(col.data.missing)); setObscured(new Set(col.data.obscured)); }
    if (cur.kind === "ok") setBrightDust(cur.data.brightDust);
    if (wl.kind === "ok") setWishlist(new Set(wl.data.items.map((i) => i.itemHash)));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Optimistic star toggle (doc 03 §4 / doc 04 §4).
  const toggleStar = useCallback(async (itemHash: number) => {
    if (auth !== "logged_in") {
      window.location.href = `/api/auth/login`;
      return;
    }
    const has = wishlist.has(itemHash);
    setWishlist((prev) => {
      const next = new Set(prev);
      has ? next.delete(itemHash) : next.add(itemHash);
      return next;
    });
    const res = has ? await api.removeStar(itemHash) : await api.addStar(itemHash);
    if (res.kind !== "ok") {
      // roll back on failure
      setWishlist((prev) => {
        const next = new Set(prev);
        has ? next.add(itemHash) : next.delete(itemHash);
        return next;
      });
    }
  }, [auth, wishlist]);

  return (
    <OverlayCtx.Provider value={{ auth, displayName, owned, missing, obscured, brightDust, wishlist, toggleStar, refresh: load }}>
      {children}
    </OverlayCtx.Provider>
  );
}
