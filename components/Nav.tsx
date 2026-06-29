"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOverlay } from "./OverlayProvider";

const links = [
  { href: "/", label: "Store" },
  { href: "/catalog", label: "Catalog" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account", label: "Account" },
];

export function Nav() {
  const path = usePathname();
  const { displayName } = useOverlay();
  return (
    <nav className="nav shell" aria-label="Primary">
      <Link href="/" className="brand">Everywherse</Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="link" aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
      {displayName ? (
        <span className="dim" style={{ fontSize: "0.85rem" }}>{displayName}</span>
      ) : (
        <a className="btn" href="/api/auth/login">Log in with Bungie</a>
      )}
    </nav>
  );
}
