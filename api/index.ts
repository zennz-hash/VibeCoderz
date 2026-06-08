import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server';

let appPromise: ReturnType<typeof createApp> | null = null;

function getApp() {
  appPromise ??= createApp();
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel sometimes strips the /api prefix from req.url. Restore it for Express router:
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  
  const app = await getApp();
  // Express expects (req, res) — forward from Vercel
  app(req as any, res as any);
}
