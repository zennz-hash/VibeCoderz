import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import authRouter, { requireAuth } from './server/routes/auth';
import blueprintsRouter from './server/routes/blueprints';
import telegramRouter from './server/routes/telegram';
import { checkQuota, consumeQuota, getActiveSubscription } from './server/routes/quota';
import prisma from './src/utils/prisma';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const groqKeys = [
    process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2
  ].filter(Boolean) as string[];

  console.log(`🔑 Loaded ${groqKeys.length} Groq API Key(s)`);

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/blueprints', blueprintsRouter);
  app.use('/api/telegram', telegramRouter);

  app.post('/api/generate-prd', requireAuth, async (req: any, res: any) => {
    try {
      const { projectType, projectName, projectDescription, isAiChoice, techStack } = req.body;
      const userId = req.user.userId;

      // ═══════════ QUOTA CHECK ═══════════
      const quota = await checkQuota(userId);
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Kuota PRD harian habis (${quota.limit}/${quota.limit}). Upgrade plan untuk kuota lebih besar.`,
          quotaExhausted: true,
          plan: quota.planType,
          limit: quota.limit,
        });
      }
      // ═══════════════════════════════════

      let prompt = `Kamu adalah Tech Lead. Pengguna ingin membuat proyek ${projectType} bernama "${projectName}" dengan deskripsi:\n"${projectDescription}"\n\n`;

      if (isAiChoice) {
        prompt += `Analisis deskripsi dan berikan tech stack open-source terbaik beserta alasannya.\n`;
      } else {
        prompt += `Gunakan stack berikut secara mutlak:\n- Frontend: ${techStack.frontend}\n- Backend: ${techStack.backend}\n- Database: ${techStack.database}\n- Deployment: ${techStack.deployment}\n`;
      }

      prompt += `\nOutput harus berisi:\n1. Executive Summary\n2. Visualisasi Sistem (Hasilkan 2-3 diagram menggunakan sintaks Mermaid.js dalam blok kode \`\`\`mermaid yang paling relevan dengan proyek ini. Pilih HANYA dari: flowchart TD untuk User Flow, flowchart LR untuk Arsitektur Database, Sequence Diagram untuk API, atau classDiagram untuk arsitektur UI)\n3. Arsitektur Sistem & Spesifikasi Teknis\n4. Vibecoding Plan (5-7 prompt spesifik yang siap di-copas developer ke AI untuk ngoding fitur dari nol).`;

      console.log('📡 Mengirim request ke Groq...');

      let response;
      let lastError: any;

      for (let i = 0; i < groqKeys.length; i++) {
        try {
          const client = new OpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: groqKeys[i],
          });
          console.log(`⏳ Mencoba dengan API Key ${i + 1}...`);

          response = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'Kamu adalah seorang Tech Lead senior yang ahli membuat Product Requirements Document (PRD). Jawab dalam Bahasa Indonesia yang profesional. Format output dalam Markdown.\n\nATURAN KRITIS UNTUK MERMAID DIAGRAM (WAJIB DIIKUTI ATAU SISTEM AKAN HANCUR):\n1. Gunakan HANYA `flowchart TD` atau `classDiagram`! DILARANG KERAS menggunakan `erDiagram`, `sequenceDiagram`, atau `stateDiagram-v2` karena parser frontend tidak mensupportnya!\n2. Untuk flowchart TD, Teks deskripsi node HARUS dibungkus TANDA KUTIP GANDA. Contoh BENAR: A["Deskripsi Penuh"] --> B["Deskripsi Lain"]. JANGAN GUNAKAN SPASI PADA ID NODE (Gunakan A, B, C, dst).\n3. Pastikan sintaks Mermaid sempurna tanpa karakter ilegal.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 4096,
          });
          
          break;
        } catch (error: any) {
          console.error(`❌ Error dengan API Key ${i + 1}:`, error?.message || error);
          lastError = error;
        }
      }

      if (!response) {
        throw lastError;
      }

      const markdown = response.choices[0]?.message?.content || '';
      console.log('✅ PRD berhasil di-generate!');

      // ═══════════ CONSUME QUOTA ═══════════
      await consumeQuota(quota.subscriptionId);
      // ═══════════════════════════════════════

      // ═══════════ AUTO-SAVE BLUEPRINT ═══════════
      try {
        await prisma.blueprint.create({
          data: {
            userId,
            name: projectName || 'Untitled PRD',
            type: projectType || 'Fullstack Web App',
            content: markdown,
          }
        });
        console.log('💾 Blueprint auto-saved to database.');
      } catch (saveErr: any) {
        console.error('⚠️ Failed to auto-save blueprint:', saveErr?.message);
        // Don't fail the whole request if save fails
      }
      // ═══════════════════════════════════════════

      // Get fresh quota info to send back
      const freshQuota = await checkQuota(userId);

      res.json({
        markdown,
        quota: {
          remaining: freshQuota.remaining,
          limit: freshQuota.limit,
          plan: freshQuota.planType,
        }
      });

    } catch (error: any) {
      console.error('❌ Error generating PRD:', error?.message || error);

      if (error?.status === 429) {
        return res.status(429).json({ error: 'Rate limit Groq tercapai pada seluruh API Key. Tunggu beberapa detik lalu coba lagi.' });
      }
      if (error?.status === 401) {
        return res.status(401).json({ error: 'API Key Groq tidak valid. Periksa kembali key Anda di file .env.' });
      }

      res.status(500).json({ error: `Gagal menghasilkan PRD: ${error?.message || 'Kesalahan server.'}` });
    }
  });

  // Server-side proxy for BuildCode AI generation (keeps API key off client)
  app.post('/api/generate-code', requireAuth, async (req: any, res: any) => {
    try {
      const { systemInstruction, messages } = req.body;
      const userId = req.user.userId;

      if (!systemInstruction || !messages) {
        return res.status(400).json({ error: 'Missing systemInstruction or messages' });
      }

      // ═══════════ QUOTA CHECK ═══════════
      const quota = await checkQuota(userId);
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Kuota harian habis (${quota.limit}/${quota.limit}). Upgrade plan Anda.`,
          quotaExhausted: true,
        });
      }
      // ═══════════════════════════════════

      let response;
      let lastError: any;

      for (let i = 0; i < groqKeys.length; i++) {
        try {
          const client = new OpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: groqKeys[i],
          });

          response = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemInstruction },
              ...messages
            ],
            response_format: { type: 'json_object' as const },
            temperature: 0.2,
          });

          break;
        } catch (error: any) {
          lastError = error;
        }
      }

      if (!response) {
        throw lastError;
      }

      // ═══════════ CONSUME QUOTA ═══════════
      await consumeQuota(quota.subscriptionId);
      // ═══════════════════════════════════════

      res.json(response);
    } catch (error: any) {
      console.error('❌ Error generating code:', error?.message || error);
      if (error?.status === 429) {
        return res.status(429).json({ error: 'Rate limit tercapai. Tunggu beberapa detik.' });
      }
      res.status(500).json({ error: `Gagal generate code: ${error?.message || 'Server error'}` });
    }
  });

  // ═══════════ USER PROFILE (fresh from DB) ═══════════
  app.get('/api/user/profile', requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const sub = await getActiveSubscription(userId);
      const planLimits: Record<string, number> = { 'FREE': 1, 'STARTER': 5, 'PRO': 999999 };
      const limit = planLimits[sub?.planType || 'FREE'] ?? 1;

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        plan: sub?.planType || 'FREE',
        quota: {
          remaining: Math.max(0, limit - (sub?.quotaUsedToday || 0)),
          limit,
          usedToday: sub?.quotaUsedToday || 0,
        },
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log('🤖 Model: Llama 3.3 70B (via Groq)\n');
  });
}

startServer();
