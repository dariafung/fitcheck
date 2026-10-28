import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Replay recordings are read with fs at request time, so the tracer cannot
  // see them; every server route may run an AI function.
  outputFileTracingIncludes: { "/**/*": ["./fixtures/ai/**/*"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
