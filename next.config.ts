import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // keep the MCP SDK on the server side untouched by bundling quirks.
  serverExternalPackages: ["@modelcontextprotocol/client", "@modelcontextprotocol/server"],
  poweredByHeader: false,
};
export default nextConfig;
