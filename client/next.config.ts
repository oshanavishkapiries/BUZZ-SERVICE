import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  allowedDevOrigins: ['3000-cs-9c0df78f-cdba-48ab-b683-3fe75f6082c4.cs-asia-southeast1-palm.cloudshell.dev']
};

export default nextConfig;
