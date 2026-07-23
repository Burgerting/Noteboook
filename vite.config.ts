import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

function localFsPlugin() {
  const LOCAL_DRIVE_PATH = 'D:/Eating/小工具/記帳記事本/local_drive';

  return {
    name: 'local-fs-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/local-fs/write') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const { filename, content } = JSON.parse(body);
              if (!fs.existsSync(LOCAL_DRIVE_PATH)) {
                fs.mkdirSync(LOCAL_DRIVE_PATH, { recursive: true });
              }
              const filePath = path.join(LOCAL_DRIVE_PATH, filename);
              // simple security check
              if (!filePath.startsWith(path.resolve(LOCAL_DRIVE_PATH))) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }
              fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url?.startsWith('/api/local-fs/read') && req.method === 'GET') {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const filename = url.searchParams.get('filename');
          if (!filename) {
            res.statusCode = 400;
            return res.end('Missing filename');
          }
          const filePath = path.join(LOCAL_DRIVE_PATH, filename);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(content);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'File not found' }));
          }
          return;
        }

        next();
      });
    }
  }
}

export default defineConfig({
  base: '/Notebooook/',
  plugins: [
    react(),
    localFsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Drive SyncApp',
        short_name: 'SyncApp',
        description: 'Google Drive synchronized notes and accounting app',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
