import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import authRouter from './server/routes/auth';
import blueprintsRouter from './server/routes/blueprints';
import telegramRouter from './server/routes/telegram';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  app.post('/api/generate-prd', async (req, res) => {
    try {
      const { projectType, projectName, projectDescription, isAiChoice, techStack } = req.body;

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
          
          break; // berhasil, keluar dari loop
        } catch (error: any) {
          console.error(`❌ Error dengan API Key ${i + 1}:`, error?.message || error);
          lastError = error;
          // Lanjut coba api key berikutnya
        }
      }

      if (!response) {
        throw lastError; // Lemparkan error terakhir ke blok catch terluar
      }

      const markdown = response.choices[0]?.message?.content || '';
      console.log('✅ PRD berhasil di-generate!');
      res.json({ markdown });

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
