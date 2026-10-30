import Link from "next/link";
import { notFound } from "next/navigation";
import { getWork } from "@/lib/services/works";
import { LectaError } from "@/lib/services/errors";
import { WorkCover, MEDIUM_KO } from "@/components/WorkCover";
import { SelectButton } from "@/components/SelectButton";
import { tagLabel } from "@/lib/recommendation/tags";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let w;
  try { w = getWork(id); } catch (e) { if (e instanceof LectaError && e.code === "WORK_NOT_FOUND") notFound(); throw e; }
  const appearsIn = getDb()
    .prepare("SELECT e.id, e.title FROM exhibition_items i JOIN exhibitions e ON e.id = i.exhibition_id WHERE i.work_id = ? AND e.visibility = 'PUBLIC' ORDER BY e.number")
    .all(id) as { id: string; title: string }[];
  return (
    <div className="wrap grid12 work-detail">
      <div className="wd-cover"><WorkCover work={w} /></div>
      <div className="wd-body">
        <p className="caption"><Link href={`/discover?medium=${w.medium}`} className="linkish">{MEDIUM_KO[w.medium]}</Link></p>
        <h1 className="display" style={{ fontSize: "clamp(44px, 6vw, 88px)", margin: "8px 0 12px" }}>{w.title}</h1>
        {w.originalTitle && <p className="serif" style={{ fontSize: 26, fontStyle: "italic", margin: "0 0 12px" }}>{w.originalTitle}</p>}
        <p className="lede">{w.synopsis}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "28px 0 40px" }}>
          <SelectButton work={{ id: w.id, title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, coverTone: w.coverTone }} className="btn" labels={["Add to selection", "In your selection"]} />
          <Link className="btn btn-ghost" href="/exhibitions/new">Start an exhibition</Link>
        </div>
        <dl className="dl">
          <dt>Creator</dt><dd>{w.creator}</dd>
          <dt>Year</dt><dd>{w.releaseYear ?? "—"}</dd>
          <dt>Taste tags</dt>
          <dd>{w.tags.map((t) => tagLabel(t.key)).join(", ")}<br /><span className="muted" style={{ fontSize: 13 }}>Curated interpretation by the Lecta team, not a fact about the work.</span></dd>
          <dt>Provenance</dt><dd>{w.source.name} ({w.metadataStatus})<br /><span className="muted" style={{ fontSize: 13 }}>{w.source.note}</span></dd>
          {appearsIn.length > 0 && (<><dt>Exhibited in</dt><dd>{appearsIn.map((e, i) => <span key={e.id}>{i ? ", " : ""}<Link className="linkish" href={`/exhibitions/${e.id}`}>{e.title}</Link></span>)}</dd></>)}
        </dl>
      </div>
    </div>
  );
}
