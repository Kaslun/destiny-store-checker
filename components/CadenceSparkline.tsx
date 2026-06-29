import type { HistoryPoint } from "@/lib/data";

export function CadenceSparkline({ series }: { series: HistoryPoint[] }) {
  const pts = series.filter((s) => s.cost != null) as Required<HistoryPoint>[];
  if (pts.length < 2) {
    return <p className="dim">Not enough history yet for a cost trend. It grows with every poll.</p>;
  }
  const w = 320, h = 48, pad = 4;
  const costs = pts.map((p) => p.cost as number);
  const min = Math.min(...costs), max = Math.max(...costs);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = (c: number) => h - pad - ((c - min) / span) * (h - pad * 2);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.cost as number).toFixed(1)}`).join(" ");
  const summary = `Cost ranged ${min.toLocaleString()} to ${max.toLocaleString()} across ${pts.length} appearances.`;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={summary} preserveAspectRatio="none">
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      <figcaption className="dim" style={{ fontSize: "0.8rem" }}>{summary}</figcaption>
    </figure>
  );
}
