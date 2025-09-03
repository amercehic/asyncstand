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
      // Proxy API requests to backend in development
      proxy:
        mode === 'development'
          ? {
              '/api': {
                target: env.VITE_API_URL || 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
                rewrite: path => path.replace(/^\/api/, ''),
              },
              '/auth': {
                target: env.VITE_API_URL || 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
              },
              '/health': {
                target: env.VITE_API_URL || 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
              },
            }
          : undefined,
    },
    build: {
      // Performance optimizations
      target: 'es2020',
      minify: isProduction ? 'terser' : 'esbuild',
      terserOptions: isProduction
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
              passes: 2,
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          }
        : undefined,
      sourcemap: !isProduction,
      // Optimize CSS
      cssCodeSplit: true,
      cssMinify: isProduction,
      // Increase performance with better compression
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          // Optimized chunk splitting for better caching and performance
          manualChunks: id => {
            // Vendor chunks - more granular splitting
            if (id.includes('node_modules')) {
              // React core
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              // Router
              if (id.includes('react-router-dom')) {
                return 'router-vendor';
              }
              // Animation library - split for lazy loading
              if (id.includes('framer-motion')) {
                return 'animation-vendor';
              }
              // UI utilities
              if (
                id.includes('lucide-react') ||
                id.includes('sonner') ||
                id.includes('clsx') ||
                id.includes('tailwind-merge')
              ) {
                return 'ui-vendor';
              }
              // HTTP client
              if (id.includes('axios')) {
                return 'http-vendor';
              }
              // Polyfills and utilities
              if (id.includes('tslib') || id.includes('regenerator')) {
                return 'polyfills';
              }
              return 'vendor';
            }

            // Feature-based chunks for code splitting
            if (id.includes('/pages/')) {
              if (
                id.includes('Login') ||
                id.includes('SignUp') ||
                id.includes('Forgot') ||
                id.includes('Reset')
              ) {
                return 'auth';
              }
              if (id.includes('Landing')) {
                return 'landing';
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
              if (id.includes('Error') || id.includes('NotFound')) {
                return 'error-pages';
              }
            }

            // Shared components
            if (id.includes('/components/ui/')) {
              return 'ui-components';
            }
            if (id.includes('/components/')) {
              return 'components';
            }

            // Context and state management
            if (id.includes('/contexts/')) {
              return 'contexts';
            }

            // Utilities and hooks
            if (id.includes('/hooks/')) {
              return 'hooks';
            }
            if (id.includes('/utils/')) {
              return 'utils';
            }

            // API layer
            if (id.includes('/lib/api')) {
              return 'api';
            }
          },
          // Optimize chunk file names with better hashing
          chunkFileNames: chunkInfo => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'chunk';
            return isProduction ? 'js/[name].[hash:8].js' : 'js/[name].js';
          },
          entryFileNames: isProduction ? 'js/[name].[hash:8].js' : 'js/[name].js',
          assetFileNames: assetInfo => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            if (/\.(css)$/.test(assetInfo.name!)) {
              return isProduction ? 'css/[name].[hash:8].[ext]' : 'css/[name].[ext]';
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name!)) {
              return isProduction ? 'images/[name].[hash:8].[ext]' : 'images/[name].[ext]';
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name!)) {
              return 'fonts/[name].[hash:8].[ext]';
            }
            return isProduction ? 'assets/[name].[hash:8].[ext]' : 'assets/[name].[ext]';
          },
        },
        // Tree-shake and remove unused code
        treeshake: {
          preset: 'recommended',
          moduleSideEffects: false,
        },
      },
      // Adjust chunk size warning
      chunkSizeWarningLimit: 500,
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
