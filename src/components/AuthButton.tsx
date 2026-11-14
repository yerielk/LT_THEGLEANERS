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
        {user.name} · Sign out
      </button>
    );
  }
  // Kakao sign-in creates the account on first use, so one button covers both
  return (
    <button type="button" className="btn btn-sm" disabled={busy} title="카카오 계정으로 로그인 또는 가입" onClick={async () => {
      setBusy(true);
      // first sign-in only: Better Auth sends brand-new accounts to the taste survey, then back here
      await authClient.signIn.social({ provider: "kakao", callbackURL: path, newUserCallbackURL: `/welcome?next=${encodeURIComponent(path)}` });
    }}>
      <span>Sign in<span className="hide-xs"> / Sign up</span></span>
    </button>
  );
}
