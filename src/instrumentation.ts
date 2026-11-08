/** Runs once when the Next.js server starts. Node-only code lives in instrumentation-node.ts (it calls process.exit). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
