import { Link } from "next-view-transitions";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p style={{ gridColumn: "1 / span 5", margin: 0 }}>
          <span className="serif" style={{ fontSize: 24, color: "var(--ink)" }}>Lecta</span> is a living exhibition of the things you love, and why.
          Built by THE GLEANERS for the 2026 UAT.
        </p>
        <p style={{ gridColumn: "7 / span 6", margin: 0 }}>
          Posters, covers and album art are shown for identification and belong to their rights holders; images are linked from Wikipedia/Wikimedia.
          Room colours come from Sanzo Wada&apos;s <i>A Dictionary of Color Combinations</i>. Agents can use Lecta through MCP — see the{" "}
          <Link className="linkish" href="/agent-lab">agent lab</Link>.
        </p>
      </div>
    </footer>
  );
}
