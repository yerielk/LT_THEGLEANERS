import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite is a Node built-in; keep the MCP SDK on the server side untouched by bundling quirks.
  serverExternalPackages: ["@modelcontextprotocol/client", "@modelcontextprotocol/server"],
  poweredByHeader: false,
};
export default nextConfig;
