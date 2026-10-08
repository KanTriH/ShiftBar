import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'], // 固定测试语言，避免依赖运行环境的浏览器语言
    environment: 'node', // 需要 localStorage 的测试文件自己在顶部写 // @vitest-environment jsdom
  },
})
