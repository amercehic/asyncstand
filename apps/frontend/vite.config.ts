/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode in the current working directory
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';

  return {
    plugins: [
      react({
        // Enable React optimization for production
        babel: isProduction
          ? {
              plugins: [['babel-plugin-react-remove-properties', { properties: ['data-testid'] }]],
            }
          : undefined,
      }),
      // Bundle analyzer (only in production)
      ...(isProduction
        ? [
            visualizer({
              filename: 'dist/stats.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['localhost', '.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    },
    build: {
      // Performance optimizations
      target: 'esnext',
      minify: 'esbuild',
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          // Optimized chunk splitting for better caching and performance
          manualChunks: id => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              if (id.includes('react-router-dom')) {
                return 'router-vendor';
              }
              if (id.includes('framer-motion')) {
                return 'animation-vendor';
              }
              if (
                id.includes('lucide-react') ||
                id.includes('sonner') ||
                id.includes('clsx') ||
                id.includes('tailwind-merge')
              ) {
                return 'ui-vendor';
              }
              if (id.includes('axios')) {
                return 'http-vendor';
              }
              return 'vendor';
            }

            // Feature-based chunks
            if (id.includes('/pages/')) {
              if (id.includes('Login') || id.includes('SignUp') || id.includes('Landing')) {
                return 'auth';
              }
              if (id.includes('Team')) {
                return 'teams';
              }
              if (id.includes('Standup') || id.includes('MagicToken')) {
                return 'standups';
              }
              if (id.includes('Integration')) {
                return 'integrations';
              }
              if (id.includes('Dashboard')) {
                return 'dashboard';
              }
            }

            // Context chunks
            if (id.includes('/contexts/')) {
              return 'contexts';
            }
          },
          // Optimize chunk file names
          chunkFileNames: chunkInfo => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'unknown';
            return `js/[name]-[hash].js`;
          },
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: assetInfo => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            if (/\.(css)$/.test(assetInfo.name!)) {
              return 'css/[name]-[hash].[ext]';
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name!)) {
              return 'images/[name]-[hash].[ext]';
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name!)) {
              return 'fonts/[name]-[hash].[ext]';
            }
            return 'assets/[name]-[hash].[ext]';
          },
        },
      },
      // Tree shaking optimizations
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'framer-motion',
        'lucide-react',
        'sonner',
        'clsx',
        'tailwind-merge',
      ],
    },
    envDir: '.', // Look for .env files in the app directory
    envPrefix: 'VITE_', // Only variables with VITE_ prefix will be exposed
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      reporters: ['verbose'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/test/', 'src/e2e/', '**/*.d.ts'],
      },
      // Exclude E2E tests from Vitest (they should only be run by Playwright)
      exclude: ['node_modules', 'src/e2e/**/*'],
    },
  };
});
