import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not advertise the framework in response headers.
  poweredByHeader: false,
};

export default nextConfig;
