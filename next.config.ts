import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: {
    '/*': ['./.env*', './.data/**/*', './test-results/**/*', './coverage/**/*'],
  },
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['@prisma/client', 'google-auth-library', '@google-cloud/storage'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" +
              (process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'") +
              "; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://tessdata.projectnaptha.com https://*.googleapis.com https://*.firebaseinstallations.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};
export default config;
