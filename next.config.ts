import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: isGitHubPages ? 'export' : undefined,
  basePath: isGitHubPages ? '/pulse-interval-timer' : '',
  assetPrefix: isGitHubPages ? '/pulse-interval-timer/' : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
