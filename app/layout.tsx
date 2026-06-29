import type { Metadata } from "next";
import "./globals.css";
import { OverlayProvider } from "@/components/OverlayProvider";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Everywherse — Eververse rotation tracker",
  description:
    "Track the live Destiny 2 Eververse rotation, browse the full cosmetic catalog, star what you want, and get notified when it returns.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <OverlayProvider>
          <Nav />
          <main className="shell">{children}</main>
          <footer className="shell faint" style={{ padding: "24px 16px", fontSize: "0.8rem" }}>
            Everywherse is an unofficial companion tool. Not affiliated with or endorsed by Bungie.
            Item data and imagery are property of Bungie. No purchases happen here.
          </footer>
        </OverlayProvider>
      </body>
    </html>
  );
}
