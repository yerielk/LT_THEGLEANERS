"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthButton({ user }: { user: { name: string } | null }) {
  const router = useRouter();
  const path = usePathname();
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <button type="button" className="text-btn" disabled={busy} onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.refresh();
        setBusy(false);
      }}>
        {user.name} · 로그아웃
      </button>
    );
  }
  return (
    <button type="button" className="text-btn" disabled={busy} onClick={async () => {
      setBusy(true);
      await authClient.signIn.social({ provider: "kakao", callbackURL: path });
    }}>
      카카오 로그인
    </button>
  );
}
