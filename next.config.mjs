import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrismPlus from 'rehype-prism-plus';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

// Regex patterns for chunk splitting
const NODE_MODULES_REGEX = /[\\/]node_modules[\\/]/;
const FRAMEWORK_REGEX =
  /[\\/]node_modules[\\/](react|react-dom|scheduler|next|@next)[\\/]/;
const UI_LIBRARIES_REGEX = /[\\/]node_modules[\\/]@radix-ui[\\/]/;
const DATA_HANDLING_REGEX =
  /[\\/]node_modules[\\/](@tanstack|react-hook-form|@hookform)[\\/]/;
const UTILITIES_REGEX =
  /[\\/]node_modules[\\/](clsx|class-variance-authority|tailwind-merge|lucide-react|fuse\.js)[\\/]/;

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Determine base path for GitHub Pages
const basePath = process.env.SKIP_BASE_PATH ? '' : '/tea-techniques';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make base path available to client-side code
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Configure MDX
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],

  // Enable static export only in production
  ...(isDev ? {} : { output: 'export' }),

  // Disable image optimization only for static export
  images: {
    unoptimized: !isDev,
  },

  // Enable trailing slashes for better static hosting
  trailingSlash: true,

  // Disabled for static generation compatibility
  reactStrictMode: false,

  // Disable powered by header
  poweredByHeader: false,

  // Configure for GitHub Pages deployment (skip for local builds)
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),

  // Performance budgets and optimizations
  experimental: {
    optimizePackageImports: [
      // Icons
      'lucide-react',
      // Radix UI components
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-separator',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-avatar',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      // Utility libraries
      'clsx',
      'class-variance-authority',
      'tailwind-merge',
    ],
  },

  // Bundle analyzer configuration
  webpack: (config, { dev, isServer }) => {
    // Performance budgets for chunks
    if (!(dev || isServer)) {
      config.performance = {
        maxAssetSize: 250_000, // 250KB
        maxEntrypointSize: 400_000, // 400KB
        hints: 'warning',
      };
    }

    // Optimize chunks
    if (!(dev || isServer)) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20_000,
          cacheGroups: {
            // Framework chunk - React, Next.js core
            framework: {
              test: FRAMEWORK_REGEX,
              name: 'framework',
              priority: 40,
              enforce: true,
            },
            // UI libraries chunk - All Radix UI components
            uiLibraries: {
              test: UI_LIBRARIES_REGEX,
              name: 'ui-libraries',
              priority: 30,
              enforce: true,
            },
            // Form and table libraries
            dataHandling: {
              test: DATA_HANDLING_REGEX,
              name: 'data-handling',
              priority: 25,
              enforce: true,
            },
            // Utilities chunk - Common utilities
            utilities: {
              test: UTILITIES_REGEX,
              name: 'utilities',
              priority: 20,
              enforce: true,
            },
            // Default vendor chunk for remaining dependencies
            vendor: {
              test: NODE_MODULES_REGEX,
              name: 'vendor',
              priority: 10,
              enforce: true,
            },
            // Common chunks for shared app code
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'wrap',
          properties: {
            className: ['anchor'],
          },
        },
      ],
      [
        rehypePrismPlus,
        {
          showLineNumbers: false,
          ignoreMissing: true,
        },
      ],
    ],
  },
});

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default bundleAnalyzer(withMDX(nextConfig));
