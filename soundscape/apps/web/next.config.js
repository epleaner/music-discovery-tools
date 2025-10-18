/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@soundscape/ui',
    '@soundscape/utils',
    '@soundscape/types',
  ],
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
};

module.exports = nextConfig;
