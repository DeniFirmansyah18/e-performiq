/** @type {import('next').NextConfig} */
process.env.TZ = 'Asia/Jakarta';

const nextConfig = {
  reactStrictMode: false,
  env: {
    TZ: 'Asia/Jakarta',
    DEFAULT_LOCALE: 'id-ID',
  },
  experimental: {
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
};

module.exports = nextConfig;
