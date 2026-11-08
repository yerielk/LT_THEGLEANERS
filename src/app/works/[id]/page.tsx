import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";
import { getWork } from "@/lib/services/works";
import { LectaError } from "@/lib/services/errors";
import { MEDIUM_KO, MEDIUM_LABEL } from "@/components/WorkCover";
import { WorkImage } from "@/components/WorkImage";
import { SelectButton } from "@/components/SelectButton";
import { SelectionShelf } from "@/components/SelectionShelf";
import { tagLabel } from "@/lib/recommendation/tags";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { exhibitionItems, exhibitions } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let w;
  try { w = await getWork(id); } catch (e) { if (e instanceof LectaError && e.code === "WORK_NOT_FOUND") notFound(); throw e; }
  const appearsIn = await getDb()
    .select({ id: exhibitions.id, title: exhibitions.title })
    .from(exhibitionItems)
    .innerJoin(exhibitions, eq(exhibitions.id, exhibitionItems.exhibitionId))
    .where(and(eq(exhibitionItems.workId, id), eq(exhibitions.visibility, "PUBLIC")))
    .orderBy(asc(exhibitions.number));
  return (
    <>
      <div className="wrap work-detail">
        <div className="wd-art" data-medium={w.medium} style={{ maxWidth: w.artwork ? Math.round(w.artwork.width * 1.5) : undefined, justifySelf: "center", width: "100%" }}><WorkImage work={w} vt={`work-${w.id}`} eager /></div>
        <div className="wd-body">
          <p className="caption"><Link href={`/discover?medium=${w.medium}`} className="linkish">{MEDIUM_LABEL[w.medium]}</Link></p>
          <h1 className="display">{w.title}</h1>
          {w.originalTitle && <p className="serif" style={{ fontSize: 26, fontStyle: "italic", margin: "0 0 8px", fontFamily: "var(--kserif)" }}>{w.originalTitle}</p>}
          <p style={{ fontSize: 15, margin: "0 0 20px" }}>{w.creator}{w.releaseYear ? `, ${w.releaseYear}` : ""}</p>
          <p className="lede">{w.synopsis}</p>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", margin: "28px 0 8px" }}>
            <SelectButton work={{ id: w.id, title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, coverTone: w.coverTone, artwork: w.artwork }} className="btn" labels={["Add to selection", "In your selection"]} />
            <Link className="btn-ghost" href="/exhibitions/new">Start an exhibition</Link>
          </div>
          <dl className="wd-meta">
            <dt>Medium</dt><dd>{MEDIUM_KO[w.medium]}</dd>
            <dt>Taste</dt><dd>{w.tags.map((t) => tagLabel(t.key)).join(", ")}<br /><span className="muted" style={{ fontSize: 12.5 }}>Lecta 팀의 큐레이션 해석이에요. 작품에 대한 사실이 아닙니다.</span></dd>
            <dt>Metadata</dt><dd>{w.source.name} ({w.metadataStatus})</dd>
            {w.artwork && <><dt>Image</dt><dd>Official artwork, © its rights holder. {w.artwork.sourcePage && <a className="linkish" href={w.artwork.sourcePage} target="_blank" rel="noreferrer">Source</a>}</dd></>}
            {appearsIn.length > 0 && <><dt>On view in</dt><dd>{appearsIn.map((e, i) => <span key={e.id}>{i ? ", " : ""}<Link className="linkish" href={`/exhibitions/${e.id}`}>{e.title}</Link></span>)}</dd></>}
          </dl>
        </div>
      </div>
      <SelectionShelf />
    </>
  );
}
