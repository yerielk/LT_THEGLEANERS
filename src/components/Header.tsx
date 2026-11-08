"use client";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { AuthButton } from "./AuthButton";

const NAV: { href: string; label: string; xs?: string; small?: boolean }[] = [
  { href: "/discover", label: "Browse works", xs: "Browse" },
  { href: "/exhibitions/new", label: "Curate" },
  { href: "/me", label: "My rooms" },
  { href: "/agent-lab", label: "Agent lab", small: true },
];

export function Header({ demo, user, showLab }: { demo: boolean; user: { name: string } | null; showLab: boolean }) {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="wrap bar">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Link href="/" className="wordmark" aria-label="Lecta home">Lecta</Link>
          {demo && <span className="demo-flag" title="DEMO_MODE=true — while signed out, saves go to the shared demo user">Demo workspace</span>}
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.filter((n) => showLab || n.href !== "/agent-lab").map((n) => (
            <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined} className={n.small ? "hide-sm" : undefined}>
              {n.xs ? <><span className="hide-xs">{n.label}</span><span className="show-xs">{n.xs}</span></> : n.label}
            </Link>
          ))}
          <AuthButton user={user} />
        </nav>
      </div>
    </header>
  );
}
