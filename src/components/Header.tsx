"use client";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { AuthButton } from "./AuthButton";

const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/me", label: "My exhibitions" },
  { href: "/agent-lab", label: "Agent lab", small: true },
];

export function Header({ demo, user }: { demo: boolean; user: { name: string } | null }) {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="wrap bar">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Link href="/" className="wordmark" aria-label="Lecta home">Lecta</Link>
          {demo && <span className="demo-flag" title="DEMO_MODE=true — while signed out, saves go to the shared demo user">Demo workspace</span>}
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined} className={n.small ? "hide-sm" : undefined}>
              {n.label}
            </Link>
          ))}
          <AuthButton user={user} />
          <Link href="/exhibitions/new" className="btn btn-sm">Curate</Link>
        </nav>
      </div>
    </header>
  );
}
