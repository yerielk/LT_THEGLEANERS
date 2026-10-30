import Link from "next/link";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="empty">
      <p className="h3" style={{ margin: 0 }}>{title}</p>
      <p className="muted" style={{ maxWidth: "38em" }}>{body}</p>
      {action && <Link className="btn btn-ghost" href={action.href}>{action.label}</Link>}
    </div>
  );
}
