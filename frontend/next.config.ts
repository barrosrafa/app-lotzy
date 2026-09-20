import type { NextConfig } from 'next';
const nextConfig: NextConfig = { reactStrictMode: true, async redirects() { return [{ source: '/conferir', destination: '/validar', statusCode: 301 }, { source: '/ferramentas', destination: '/history', statusCode: 301 }, { source: '/carteira', destination: '/history', statusCode: 301 }]; } };
export default nextConfig;
