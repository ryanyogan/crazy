import { defineConfig } from 'vite-plus'

// Workspace-level Vite+ config: lint (Oxlint), format (Oxfmt) and test
// (Vitest) for every package. Each app keeps its own vite.config.ts for
// dev/build.

const IGNORED = [
  '**/dist/**',
  '**/generated/**',
  '**/routeTree.gen.ts',
  '**/worker-configuration.d.ts',
]

export default defineConfig({
  lint: {
    plugins: ['typescript', 'react', 'jsx-a11y', 'import'],
    ignorePatterns: [...IGNORED, 'docs/**', '.scratch/**'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      // ADR 0002: the Agents SDK is used from one module, so it can be swapped.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'agents', message: 'Only apps/core/src/coordinator/sdk.ts imports the SDK.' },
          ],
          patterns: [{ group: ['agents/*'], message: 'Only the Coordinator sdk module may.' }],
        },
      ],
    },
    overrides: [
      { files: ['apps/core/src/coordinator/sdk.ts'], rules: { 'no-restricted-imports': 'off' } },
      {
        // ADR 0002: the web app has no code path that writes to D1.
        files: ['apps/web/**'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              paths: [
                { name: 'agents', message: 'The web app reaches the Coordinator by its binding.' },
                {
                  name: '@crazy/db/write',
                  message: 'The web app never writes to D1. Hand the write to the Coordinator.',
                },
                { name: '@prisma/client', message: 'Read through @crazy/db.' },
                { name: '@prisma/adapter-d1', message: 'Read through @crazy/db.' },
              ],
            },
          ],
        },
      },
    ],
  },
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    ignorePatterns: [
      ...IGNORED,
      'docs/design/**',
      '.scratch/**',
      'pnpm-lock.yaml',
      '**/industry.css',
    ],
  },
  test: {
    projects: [
      // Pure TypeScript: the shared domain rules (most tests live here) and the
      // visual comparison harness's own arithmetic.
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts'],
          exclude: ['packages/db/**'],
        },
      },
      // The Coordinator seam, the read-model seam and the web app's Attachment
      // seam, inside workerd against a local D1 (and, for the last, a local R2).
      'apps/core/vite.config.ts',
      'packages/db/vite.config.ts',
      'apps/web/vitest.config.ts',
    ],
  },
})
