import { defineConfig } from 'vitest/config';

// 测试仅限本项目 src/ 下的纯逻辑单元；排除 docs/ 内的无关捆绑工程
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'docs/**', 'dist/**', 'src-tauri/**'],
  },
});
