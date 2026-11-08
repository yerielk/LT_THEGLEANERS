import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./db";
import { account, session, user, verification } from "./schema";

/**
 * Kakao login via Better Auth. Kakao only releases the email to business-verified apps, and asking for the
 * account_email scope without that permission fails the login (KOE205), so we ask for nickname and profile
 * image only. Better Auth needs an email, so users without one get a non-deliverable placeholder.
 * Set KAKAO_REQUEST_EMAIL=true once the Kakao app is allowed to request it.
 */
const requestEmail = process.env.KAKAO_REQUEST_EMAIL === "true";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } }),
  socialProviders: {
    kakao: {
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || undefined,
      disableDefaultScope: true,
      scope: requestEmail ? ["profile_nickname", "profile_image", "account_email"] : ["profile_nickname", "profile_image"],
      mapProfileToUser: (profile) =>
        profile.kakao_account?.email ? {} : { email: `kakao_${profile.id}@users.lecta.invalid`, emailVerified: false },
    },
  },
  plugins: [nextCookies()],
});
