export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}
