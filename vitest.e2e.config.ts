import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts']
  },
  define: {
    CSB_SDK_VERSION: JSON.stringify('2.1.0-rc.4'),
  },
})