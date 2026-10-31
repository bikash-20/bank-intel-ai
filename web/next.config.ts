import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_WORKER_URL:
      process.env.NEXT_PUBLIC_WORKER_URL ||
      'https://bank-intel-worker.talukderbikash500.workers.dev',
  },
};

export default nextConfig;

