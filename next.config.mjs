/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.SCOUTER_BUILD_DIR || '.next',
  webpack: (config) => {
    // svgr
    config.module.rules.push({
      test: /\.svg$/i,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            typescript: true,
            icon: true,
            dimensions: false,
            svgo: false,
            // removeAttributes: {}
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;

