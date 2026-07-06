import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'question-storybook-ui': path.resolve(__dirname, '../storybook-ui/src/components/index.js'),
    },
  },
  server: {
    port: 3005,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});