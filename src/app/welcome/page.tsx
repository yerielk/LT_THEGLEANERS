import type { Metadata } from "next";
import { searchWorks, getWorksByIds } from "@/lib/services/works";
import { getTaste, ONBOARDING_MAX, ONBOARDING_MIN } from "@/lib/services/taste";
import { webActor } from "@/lib/services/web-actor";
import { AuthButton } from "@/components/AuthButton";
import { WelcomeClient } from "./WelcomeClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome" };

/** Only same-site paths, so `?next=` cannot send the user off to another origin. */
function safeNext(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/welcome") ? raw : "/";
}

/**
 * First-run taste survey, shown full screen right after a Kakao sign-up (see AuthButton's newUserCallbackURL):
 * works float as bubbles and the user taps the ones they love.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const actor = await webActor();

  if (!actor.userId) {
    return (
      <div className="onboard">
        <header className="onboard-head" style={{ marginTop: "20vh" }}>
          <h1 className="h3">로그인하고 좋아하는 작품을 골라 주세요.</h1>
          <p className="muted">고른 작품으로 취향을 읽고 첫 추천을 만들어 드려요.</p>
          <AuthButton user={null} />
        </header>
      </div>
    );
  }

  // the whole catalog on the mixed shelf order, works with an image first so the opening field is not all type
  const [{ works }, taste] = await Promise.all([searchWorks({ limit: 500 }), getTaste(actor)]);
  const pool = [...works.filter((w) => w.artwork), ...works.filter((w) => !w.artwork)];
  const picked = await getWorksByIds(taste.workIds);
  return (
    <WelcomeClient pool={pool} initialPicked={picked} next={next} min={ONBOARDING_MIN} max={ONBOARDING_MAX}
      userName={actor.kind === "user" ? actor.label : null} />
  );
}
