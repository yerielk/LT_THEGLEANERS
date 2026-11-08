import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/** Better Auth endpoints: /api/auth/sign-in/social, /api/auth/callback/kakao, /api/auth/sign-out, … */
export const { GET, POST } = toNextJsHandler(auth);
