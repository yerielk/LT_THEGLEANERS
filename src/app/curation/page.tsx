import { redirect } from "next/navigation";

export default async function CurationAlias({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(typeof q === "string" && q.trim() ? `/curations?q=${encodeURIComponent(q.slice(0, 80))}` : "/curations");
}
