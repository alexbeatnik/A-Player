import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Separate from electron.vite.config.ts on purpose: that file describes three
 * Electron bundles, none of which is a test runner. Only the path aliases are
 * shared, and they are short enough to repeat.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Node by default — most of what is worth unit testing is pure logic from
    // the main process. Renderer tests opt into jsdom with a docblock.
    environment: 'node'
  }
})
