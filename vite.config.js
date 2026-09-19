import { defineConfig, loadEnv } from 'vite';
import { painelPlugin } from './server/painel.mjs';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [painelPlugin(loadEnv(mode, process.cwd(), ''), process.cwd())],
  build: {
    outDir: 'dist',
    rolldownOptions: { input: { inicio: 'index.html', dados: 'dados.html' } },
  },
}));
