import type { NextConfig } from "next";

// Set by the GitHub Pages deploy workflow to "/<repo-name>" so the static
// export works from a project subpath; empty for local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export — the prototype has no server-side behavior, and GitHub
  // Pages can only host static assets.
  output: "export",
  // Emit /supplier-email/index.html (and the buyer-email / lead routes) so
  // Pages serves each preview as a directory.
  trailingSlash: true,
  basePath,
  // The default next/image loader needs a server; serve files as-is.
  images: { unoptimized: true },
  // A stray lockfile in the home directory otherwise makes Next.js guess the
  // wrong workspace root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
