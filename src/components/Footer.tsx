import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap grid12" style={{ rowGap: 16 }}>
        <p style={{ gridColumn: "1 / span 5", margin: 0 }}>
          <span className="serif" style={{ fontSize: 22, color: "var(--ink)" }}>Lecta</span> is a living exhibition of the things you love, and why.
          Built by THE GLEANERS for the 2026 UAT.
        </p>
        <p style={{ gridColumn: "7 / span 6", margin: 0 }}>
          Covers are typographic plates made by Lecta, not official artwork. Work metadata is entered by the team (marked CURATED);
          taste tags are our curated interpretation. Agents can use Lecta through MCP — see the <Link className="linkish" href="/agent-lab">agent lab</Link>.
        </p>
      </div>
    </footer>
  );
}
