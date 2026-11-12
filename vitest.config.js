import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.js', 'tests/security/**/*.test.js'], environment: 'node' } });
