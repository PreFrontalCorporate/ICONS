/* eslint-disable @typescript-eslint/no-var-requires */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/manifest\.json$/]
});

module.exports = withPWA({
  reactStrictMode: true,
  images: { formats: ['image/webp'] }
});
