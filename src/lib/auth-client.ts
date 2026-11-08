import { createAuthClient } from "better-auth/react";

/** Browser side of Better Auth (same origin, /api/auth). */
export const authClient = createAuthClient();
