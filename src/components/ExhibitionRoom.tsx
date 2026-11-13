import { Link } from "next-view-transitions";
import type { CSSProperties } from "react";
import type { ExhibitionView } from "@/lib/services/exhibitions";
import { WorkImage } from "./WorkImage";
import { MEDIUM_KO } from "./WorkCover";
import { CopyLink } from "./CopyLink";
import { RoomWall } from "./RoomWall";
import { wallFor } from "@/lib/design";
import { CurationIdentity } from "./CurationCover";

/** An exhibition as a room: a painted entrance wall, then the works hung on one eye line with wall labels. */
export function ExhibitionRoom({ ex }: { ex: ExhibitionView }) {
  const wall = wallFor(ex.number);
  const date = new Date(ex.updatedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="room" style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties}>
      <RoomWall>
        <header className="entry-panel" style={{ viewTransitionName: `room-${ex.id}` }}>
          <CurationIdentity number={ex.number} title={ex.title} description={ex.description}
            status={ex.isEditorial ? "Editorial sample" : ex.visibility === "PUBLIC" ? "Public" : "Private draft"} />
          <div>
            <p className="byline">
              <span className="nobr">Curated by {ex.ownerName}</span><br />
              <span className="nobr">{ex.items.length} works</span> / <span className="nobr">{date}</span> / <span className="nobr">wall: {wall.name}</span>
            </p>
            <div className="actions">
              <CopyLink isDraft={ex.visibility !== "PUBLIC"} />
              {ex.isOwner && <Link className="btn-ghost" href={`/exhibitions/${ex.id}/edit`}>Edit</Link>}
            </div>
          </div>
        </header>
        {ex.items.map((it, i) => <HungWork key={it.workId} it={it} i={i} />)}
        <div className="wall-end">
          <p className="h3">Keep walking.</p>
          <p style={{ margin: 0 }}>아래에서 이 방에 어울리는 다음 작품을 찾아보세요.</p>
        </div>
      </RoomWall>
    </div>
  );
}

function HungWork({ it, i }: { it: ExhibitionView["items"][number]; i: number }) {
  const ar = it.work.artwork ? it.work.artwork.width / it.work.artwork.height : it.work.medium === "ALBUM" ? 1 : it.work.medium === "SERIES" ? 1.6 : 2 / 3;
  return (
    <figure className="hung" data-medium={it.work.medium} style={{ margin: 0, "--ar": ar } as CSSProperties}>
      <Link href={`/works/${it.workId}`} aria-label={`${it.work.title}, details`}>
        <WorkImage work={it.work} vt={`work-${it.workId}`} eager={i < 3} />
      </Link>
      <figcaption className="label">
        <span className="l-title"><span className="num">{String(i + 1).padStart(2, "0")}</span>{it.work.title}</span>
        <span className="l-line">{it.work.creator}{it.work.releaseYear ? `, ${it.work.releaseYear}` : ""}</span>
        <span className="l-line">{MEDIUM_KO[it.work.medium]}</span>
        {it.curatorNote && <span className="l-line" style={{ color: "var(--ink)", marginTop: 6, fontFamily: "var(--kserif)" }}>“{it.curatorNote}”</span>}
      </figcaption>
    </figure>
  );
}
