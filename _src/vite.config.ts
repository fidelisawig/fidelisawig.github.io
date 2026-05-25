import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

function geopackageWasmPlugin() {
  const wasmPath = path.resolve(__dirname, 'node_modules/@ngageoint/geopackage/dist/sql-wasm.wasm');
  
  return {
    name: 'geopackage-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url ? req.url.split('?')[0] : '';
        if (urlPath === '/sql-wasm.wasm' || urlPath === '/assets/sql-wasm.wasm') {
          if (fs.existsSync(wasmPath)) {
            res.setHeader('Content-Type', 'application/wasm');
            res.end(fs.readFileSync(wasmPath));
            return;
          }
        }
        next();
      });
    },
    writeBundle() {
      const destPath = path.resolve(__dirname, 'dist/sql-wasm.wasm');
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      if (fs.existsSync(wasmPath)) {
        fs.copyFileSync(wasmPath, destPath);
        console.log('Copied sql-wasm.wasm to dist/');
      }
    }
  };
}

export default defineConfig(() => {
  return {
    base: '/wilayahstudi/',
    plugins: [react(), tailwindcss(), geopackageWasmPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
