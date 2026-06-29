import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem, getItemHistory, getCurrentRotationFor, getPreviewItems } from "@/lib/data";
import { formatCost, relDate } from "@/lib/format";
import { CadenceSparkline } from "@/components/CadenceSparkline";
import { ItemDetailStar } from "@/components/ItemDetailStar";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const itemHash = Number(hash);
  if (!Number.isInteger(itemHash)) notFound();

  const item = await getItem(itemHash);
  if (!item) notFound();

  const [history, live, preview] = await Promise.all([
    getItemHistory(itemHash),
    getCurrentRotationFor(itemHash),
    getPreviewItems(item.previewItemHashes ?? []),
  ]);

  return (
    <article style={{ maxWidth: 820 }}>
      <Link href="/catalog" className="dim" style={{ fontSize: "0.85rem" }}>← Back to catalog</Link>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap", marginTop: 12 }}>
        {item.screenshotUrl && (
          <img src={item.screenshotUrl} alt={item.name}
               style={{ width: "100%", maxWidth: 420, borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
        )}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{item.name}</h1>
            <ItemDetailStar itemHash={item.itemHash} />
          </div>
          {item.itemType && <p className="dim" style={{ marginTop: 4 }}>{item.itemType}{item.itemSubtype ? ` · ${item.itemSubtype}` : ""}</p>}
          {item.description && <p>{item.description}</p>}

          {live ? (
            <p><strong>Live now:</strong> {formatCost(live.cost, live.currency)}</p>
          ) : (
            <p className="dim">Not in the current rotation. Last seen {relDate(history.lastSeen)}.</p>
          )}

          <p className="dim" style={{ fontSize: "0.85rem" }}>
            To acquire: open Destiny 2 and visit Tess Everis at the Tower. Everywherse does not sell items.
          </p>
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "var(--fs-title)" }}>Rotation history</h2>
        <p className="dim" style={{ fontSize: "0.85rem", marginTop: 0 }}>
          {history.appearances} recorded {history.appearances === 1 ? "appearance" : "appearances"} ·
          last seen {relDate(history.lastSeen)}
        </p>
        <CadenceSparkline series={history.series} />
      </section>

      {preview.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "var(--fs-title)" }}>Bundle contents</h2>
          <div className="grid">
            {preview.map((p) => (
              <Link key={p.itemHash} href={`/item/${p.itemHash}`} className="card">
                <span className="thumb">{p.iconUrl && <img src={p.iconUrl} alt={p.name} />}</span>
                <span className="body"><span className="name">{p.name}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
