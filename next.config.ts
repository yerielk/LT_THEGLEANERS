import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // keep the MCP SDK on the server side untouched by bundling quirks.
  serverExternalPackages: ["@modelcontextprotocol/client", "@modelcontextprotocol/server"],
  poweredByHeader: false,
  // self-contained server for the Docker image only, so local `npm start` keeps working (see Dockerfile)
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};
export default nextConfig;
