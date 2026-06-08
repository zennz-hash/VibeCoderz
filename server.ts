import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import OpenAI from 'openai';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRouter, { requireAuth } from './server/routes/auth';
import blueprintsRouter, { getBlueprintRow } from './server/routes/blueprints';
import codeProjectsRouter from './server/routes/codeProjects';
import adminRouter from './server/routes/admin';
import { checkQuota, getActiveSubscription, claimQuota, refundQuota } from './server/routes/quota';
import { ValidationError, asObject, readBoolean, readChatMessages, readString, readStringRecord } from './server/utils/validation';
import { assertValidEnvironment } from './server/utils/env';
import { recordAiRequest, recordAuditLog } from './server/utils/audit';
import { backfillMissingBlueprintVersions, createBlueprintVersion } from './server/utils/blueprintVersions';
import { ROUTER9_MODEL_MAP, getCodeModelAttempts, getPrdModelAttempts } from './server/utils/aiModels';
import prisma from './src/utils/prisma';

type PublicShareRow = {
  id: string;
  name: string;
  type: string;
  content: string;
  createdAt: Date | string;
  shareExpiresAt: Date | string | null;
  shareViewCount: number | bigint | null;
  userName: string | null;
  userPicture: string | null;
};

/* 9router gateway (OpenAI-compatible). Provider AI utama bila dikonfigurasi. */
function router9Config(maxTokens = 16384, model?: string): { baseURL: string; apiKey: string; model: string; maxTokens: number; label: string } | null {
  if (!process.env.ROUTER9_API_KEY || !process.env.ROUTER9_BASE_URL) return null;
  const resolvedModel = model || process.env.ROUTER9_MODEL || 'ag/gemini-3-flash';
  return {
    baseURL: process.env.ROUTER9_BASE_URL,
    apiKey: process.env.ROUTER9_API_KEY,
    model: resolvedModel,
    maxTokens,
    label: `9router:${resolvedModel}`,
  };
}

function publicCodeGenerationError(error: any) {
  if (error?.status === 429) return 'Rate limit AI tercapai. Tunggu beberapa detik lalu coba lagi.';
  if (error?.status === 413 || error?.message?.includes('too large') || error?.message?.includes('token')) {
    return 'Input terlalu panjang untuk diproses. Coba persingkat instruksi.';
  }
  if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
    return 'Model AI belum tersedia untuk konfigurasi saat ini. Sistem sudah mencoba fallback, coba pilih model lain atau hubungi admin.';
  }
  return 'Gagal generate code. Coba lagi atau pilih model berbeda.';
}

async function enforceLogRetention() {
  const days = Number(process.env.LOG_RETENTION_DAYS || 90);
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [auditDeleted, aiDeleted] = await Promise.all([
    prisma.$executeRaw`DELETE FROM AuditLog WHERE createdAt < ${cutoff}`,
    prisma.$executeRaw`DELETE FROM AiRequestLog WHERE createdAt < ${cutoff}`,
  ]);
  if (Number(auditDeleted) > 0 || Number(aiDeleted) > 0) {
    console.log(`🧹 Log retention cleaned ${auditDeleted} audit log(s), ${aiDeleted} AI request log(s).`);
  }
}

export async function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const trustProxyEnv = (process.env.TRUST_PROXY || '').trim();
  if (trustProxyEnv) {
    const trustProxyValue = trustProxyEnv === 'true'
      ? 1
      : trustProxyEnv === 'false'
        ? false
        : /^\d+$/.test(trustProxyEnv)
          ? Number(trustProxyEnv)
          : trustProxyEnv;
    app.set('trust proxy', trustProxyValue);
  }

  app.use(express.json({ limit: '1mb' }));

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", 'https://accounts.google.com', 'https://apis.google.com'],
        connectSrc: [
          "'self'",
          'https://accounts.google.com',
          'https://oauth2.googleapis.com',
          'https://www.googleapis.com',
          'https://*.codesandbox.io',
          'wss://*.codesandbox.io',
          'https://*.csb.app',
          'wss://*.csb.app',
        ],
        frameSrc: ["'self'", 'blob:', 'https://accounts.google.com', 'https://*.codesandbox.io', 'https://*.csb.app'],
        workerSrc: ["'self'", 'blob:'],
      },
    } : false,
    crossOriginOpenerPolicy: false // Google OAuth popup flow needs opener access.
  }));

  const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  app.use(cors(isProduction
    ? {
        origin: allowedOrigins.length > 0 ? (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error('Not allowed by CORS'));
        } : false,
        credentials: true,
      }
    : {
        origin: true,
        credentials: true,
      }
  ));

  /* Rate limiters */
  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Terlalu banyak request AI. Tunggu 1 menit.' } });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Terlalu banyak percobaan login. Tunggu 15 menit.' } });
  // S-06: Rate limit share endpoint — cegah brute-force token
  const shareLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Terlalu banyak request share. Tunggu 1 menit.' } });

  app.use('/api/auth', authLimiter);
  app.use('/api/generate-prd', aiLimiter);
  app.use('/api/revise-prd', aiLimiter);
  app.use('/api/generate-code', aiLimiter);
  app.use('/api/share', shareLimiter);

  console.log(`🔑 9router: ${process.env.ROUTER9_API_KEY ? 'SET (' + (process.env.ROUTER9_MODEL || 'ag/gemini-3-flash') + ')' : '❌ NOT SET'}`);
  if (!process.env.ROUTER9_API_KEY) {
    console.warn('⚠️  WARNING: ROUTER9_API_KEY tidak diset. Semua fitur generate akan gagal.');
  }
  if (!process.env.VITE_GOOGLE_CLIENT_ID) {
    console.warn('⚠️  WARNING: VITE_GOOGLE_CLIENT_ID belum diset. Login Google akan gagal.');
  }

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/blueprints', blueprintsRouter);
  app.use('/api/code-projects', codeProjectsRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        database: 'ok',
        time: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'degraded',
        database: 'error',
        time: new Date().toISOString(),
      });
    }
  });

  /* ═══════════ PUBLIC SHARE ENDPOINT (no auth) ═══════════ */
  app.get('/api/share/:token', async (req: any, res: any) => {
    try {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'no-store');

      const rows = await prisma.$queryRaw<PublicShareRow[]>`
        SELECT
          b.id,
          b.name,
          b.type,
          b.content,
          b.createdAt,
          b.shareExpiresAt,
          b.shareViewCount,
          u.name AS userName,
          u.picture AS userPicture
        FROM Blueprint b
        JOIN User u ON u.id = b.userId
        WHERE b.shareToken = ${req.params.token}
          AND b.isPublic = 1
        LIMIT 1
      `;
      const blueprint = rows[0];
      if (!blueprint) return res.status(404).json({ error: 'Blueprint not found or not public' });

      const expiresAt = blueprint.shareExpiresAt ? new Date(blueprint.shareExpiresAt) : null;
      if (expiresAt && expiresAt <= new Date()) {
        await prisma.$executeRaw`
          UPDATE Blueprint
          SET isPublic = 0, shareToken = NULL, shareExpiresAt = NULL, updatedAt = ${new Date()}
          WHERE id = ${blueprint.id}
        `.catch(() => {});
        return res.status(404).json({ error: 'Share link expired' });
      }

      await prisma.$executeRaw`
        UPDATE Blueprint
        SET shareViewCount = COALESCE(shareViewCount, 0) + 1, updatedAt = ${new Date()}
        WHERE id = ${blueprint.id}
      `.catch(() => {});

      const viewCount = Number(blueprint.shareViewCount || 0) + 1;

      res.json({
        name: blueprint.name,
        type: blueprint.type,
        content: blueprint.content,
        author: { name: blueprint.userName, picture: blueprint.userPicture },
        createdAt: blueprint.createdAt,
        shareExpiresAt: expiresAt,
        shareViewCount: viewCount,
      });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
  });

  /* ═══════════ TOGGLE SHARE ═══════════ */
  app.post('/api/blueprints/:id/share', requireAuth, async (req: any, res: any) => {
    try {
      const bp = await prisma.blueprint.findFirst({ where: { id: req.params.id, userId: req.user.userId } });
      if (!bp) return res.status(404).json({ error: 'Not found' });
      const crypto = await import('crypto');
      const shareToken = bp.isPublic ? bp.shareToken : crypto.randomBytes(16).toString('hex');
      const shareExpiresAt = bp.isPublic ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (bp.isPublic) {
        await prisma.$executeRaw`
          UPDATE Blueprint
          SET isPublic = 0, shareToken = NULL, shareExpiresAt = NULL, updatedAt = ${new Date()}
          WHERE id = ${bp.id}
        `;
        await recordAuditLog({
          userId: req.user.userId,
          action: 'BLUEPRINT_SHARE_DISABLE',
          targetType: 'Blueprint',
          targetId: bp.id,
          req,
        });
        return res.json({ isPublic: false, shareToken: null, shareExpiresAt: null });
      }

      await prisma.$executeRaw`
        UPDATE Blueprint
        SET isPublic = 1,
            shareToken = ${shareToken},
            shareExpiresAt = ${shareExpiresAt},
            shareViewCount = 0,
            updatedAt = ${new Date()}
        WHERE id = ${bp.id}
      `;
      await recordAuditLog({
        userId: req.user.userId,
        action: 'BLUEPRINT_SHARE_ENABLE',
        targetType: 'Blueprint',
        targetId: bp.id,
        metadata: { shareExpiresAt },
        req,
      });
      res.json({ isPublic: true, shareToken, shareExpiresAt });
    } catch (e) { res.status(500).json({ error: 'Failed to toggle share' }); }
  });

  /* ═══════════ REAL ANALYTICS ═══════════ */
  app.get('/api/analytics', requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user.userId;
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const logs = await prisma.usageLog.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'asc' }
      });
      /* Group by date */
      const grouped: Record<string, { prd: number, code: number, revise: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
        grouped[key] = { prd: 0, code: 0, revise: 0 };
      }
      logs.forEach(log => {
        const key = new Date(log.createdAt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
        if (grouped[key]) {
          if (log.type === 'PRD_GENERATE') grouped[key].prd++;
          if (log.type === 'CODE_GENERATE') grouped[key].code++;
          if (log.type === 'PRD_REVISE') grouped[key].revise++;
        }
      });
      const chartData = Object.entries(grouped).map(([date, v]) => ({ date, prd: v.prd, code: v.code, revise: v.revise }));
      const totals = { prd: logs.filter(l => l.type === 'PRD_GENERATE').length, code: logs.filter(l => l.type === 'CODE_GENERATE').length, revise: logs.filter(l => l.type === 'PRD_REVISE').length };
      res.json({ chartData, totals });
    } catch (e) { res.status(500).json({ error: 'Failed to get analytics' }); }
  });

  /* ═══════════ PRD TEMPLATES ═══════════ */
  app.get('/api/templates', requireAuth, (req: any, res: any) => {
    res.json([
      { id: 't1', name: 'E-Commerce Marketplace', type: 'Fullstack Web App', description: 'Platform jual-beli online dengan fitur keranjang, checkout, payment gateway, manajemen seller & buyer, sistem review, voucher promo, dan tracking pengiriman.', icon: '🛒' },
      { id: 't2', name: 'SaaS Dashboard', type: 'Fullstack Web App', description: 'Platform SaaS multi-tenant dengan subscription billing, role-based access control, analytics dashboard, webhook integration, dan audit log.', icon: '📊' },
      { id: 't3', name: 'Social Media App', type: 'Android', description: 'Aplikasi sosial media dengan fitur feed, stories, direct messaging, notifikasi real-time, user profile, follow system, dan content recommendation.', icon: '💬' },
      { id: 't4', name: 'Learning Management System', type: 'Website', description: 'Platform e-learning dengan video streaming, kuis & ujian online, sertifikat digital, progress tracking, forum diskusi, dan live class.', icon: '📚' },
      { id: 't5', name: 'Fintech Wallet', type: 'Android', description: 'Aplikasi dompet digital dengan fitur top-up, transfer, pembayaran QR, riwayat transaksi, KYC verification, dan multi-currency support.', icon: '💳' },
      { id: 't6', name: 'Property Listing', type: 'Website', description: 'Platform listing properti dengan pencarian & filter, peta lokasi interaktif, virtual tour, kalkulator KPR, booking kunjungan, dan dashboard agen.', icon: '🏠' },
      { id: 't7', name: 'Food Delivery', type: 'Android', description: 'Aplikasi delivery makanan dengan menu digital, ordering, delivery tracking real-time, rating & review, loyalty points, dan kitchen display system.', icon: '🍔' },
      { id: 't8', name: 'HR & Payroll System', type: 'Fullstack Web App', description: 'Sistem manajemen SDM dengan absensi, payroll, slip gaji, manajemen cuti, rekrutmen online, KPI review, dan org chart.', icon: '👥' },
      { id: 't9', name: 'Healthcare / Telemedicine', type: 'Fullstack Web App', description: 'Platform kesehatan dengan rekam medis elektronik, booking dokter, telemedicine video call, e-resep, reminder obat, dan dashboard dokter.', icon: '🏥' },
      { id: 't10', name: 'Project Management Tool', type: 'Website', description: 'Tool manajemen proyek dengan kanban board, timeline gantt, task assignment, file sharing, real-time collaboration, dan reporting.', icon: '📋' },
    ]);
  });

  app.post('/api/generate-prd', requireAuth, async (req: any, res: any) => {
    let claimedQuota: string | null = null;
    let requestUserId: string | null = null;
    const requestStartedAt = Date.now();
    try {
      const body = asObject(req.body);
      if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

      const projectType = readString(body, 'projectType', { required: true, max: 80 });
      const projectName = readString(body, 'projectName', { required: true, max: 120 });
      const projectDescription = readString(body, 'projectDescription', { required: true, max: 10000 });
      const isAiChoice = readBoolean(body, 'isAiChoice', true);
      const techStack = readStringRecord(body, 'techStack');
      const modelSelection = readString(body, 'modelSelection', { max: 80 });
      const userId = req.user.userId;
      requestUserId = userId;

      if (!router9Config()) {
        return res.status(400).json({ error: '9router belum dikonfigurasi (ROUTER9_API_KEY dan ROUTER9_BASE_URL).' });
      }

      // ═══════════ ATOMIC QUOTA CLAIM ═══════════
      const quota = await claimQuota(userId, 'prd');
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Kuota PRD harian habis (${quota.limit}/${quota.limit}). Upgrade plan untuk kuota lebih besar.`,
          quotaExhausted: true,
          plan: quota.planType,
          limit: quota.limit,
        });
      }
      claimedQuota = quota.subscriptionId;
      // ═══════════════════════════════════

      let prompt = `Kamu adalah Tech Lead. Pengguna ingin membuat proyek ${projectType} bernama "${projectName}" dengan deskripsi:\n"${projectDescription}"\n\n`;

      if (isAiChoice) {
        prompt += `Analisis deskripsi dan berikan tech stack open-source terbaik beserta alasannya.\n`;
      } else {
        prompt += `Gunakan stack berikut secara mutlak:\n- Frontend: ${techStack.frontend}\n- Backend: ${techStack.backend}\n- Database: ${techStack.database}\n- Deployment: ${techStack.deployment}\n`;
      }

      prompt += `\nOutput harus berisi:\n1. Executive Summary\n2. Visualisasi Sistem (Hasilkan 2-3 diagram menggunakan sintaks Mermaid.js dalam blok kode \`\`\`mermaid yang paling relevan dengan proyek ini. Pilih HANYA dari: flowchart TD untuk User Flow, flowchart LR untuk Arsitektur Database, Sequence Diagram untuk API, atau classDiagram untuk arsitektur UI)\n3. Arsitektur Sistem & Spesifikasi Teknis\n4. Vibecoding Plan (5-7 prompt spesifik yang siap di-copas developer ke AI untuk ngoding fitur dari nol).`;

      console.log(`📡 Mengirim request ke AI... (Model: ${modelSelection || 'PRD Thinking'})`);

      let response;
      let lastError: any;
      let usedModelLabel = modelSelection || 'PRD Thinking';
      let usedModel = ROUTER9_MODEL_MAP[usedModelLabel] ?? ROUTER9_MODEL_MAP['PRD Thinking'];

      const prdAttempts = getPrdModelAttempts(modelSelection);
      for (const attempt of prdAttempts) {
        const prdSystem = attempt.isPowerModel
          ? 'Kamu adalah Principal Software Architect berkelas dunia. Buat PRD Bahasa Indonesia dalam Markdown yang mendetail dan komprehensif. MERMAID: HANYA flowchart TD, classDiagram. Node ID tanpa spasi, label dalam tanda kutip ganda. Contoh: A["Label"] --> B["Label"].'
          : 'Kamu Tech Lead senior. Buat PRD Bahasa Indonesia dalam Markdown.\nMERMAID: HANYA flowchart TD atau classDiagram. Node ID tanpa spasi, label dalam tanda kutip ganda. Contoh: A["Label"] --> B["Label"].';

        const finalPrompt = attempt.isPowerModel
          ? prompt + `\n\nTAMBAHAN INSTRUKSI:\nBerikan analisis SANGAT MENDALAM dan KOMPREHENSIF. Tambahkan:\n5. Skema Database Detail (tabel, kolom, relasi, indeks).\n6. Strategi Keamanan & Skalabilitas.\n7. Rencana Mitigasi Risiko Teknis (minimal 5 risiko).\n8. Estimasi Timeline & Milestones (MVP, Beta, Production).`
          : prompt;

        const prdMessages = [
          { role: 'system' as const, content: prdSystem },
          { role: 'user' as const, content: finalPrompt },
        ];

        const r9 = router9Config(attempt.maxTokens, attempt.model);
        if (!r9) throw new Error('9router belum dikonfigurasi.');

        console.log(`🧠 PRD via 9router: ${attempt.model}${attempt.label !== (modelSelection || 'PRD Thinking') ? ` (fallback dari ${modelSelection})` : ''}`);

        try {
          const client = new OpenAI({ baseURL: r9.baseURL, apiKey: r9.apiKey, timeout: attempt.timeoutMs });

          // Pakai streaming untuk model besar agar tidak timeout
          if (attempt.isPowerModel) {
            const stream = await client.chat.completions.create({
              model: r9.model,
              messages: prdMessages,
              temperature: 0.6,
              max_tokens: r9.maxTokens,
              stream: true,
            });
            let fullContent = '';
            for await (const chunk of stream) {
              fullContent += chunk.choices[0]?.delta?.content || '';
            }
            response = { choices: [{ message: { content: fullContent } }] } as any;
            console.log(`✅ PRD ${attempt.model} response received! (${fullContent.length} chars)`);
          } else {
            response = await client.chat.completions.create({
              model: r9.model,
              messages: prdMessages,
              temperature: 0.6,
              max_tokens: r9.maxTokens,
            });
          }
          usedModelLabel = attempt.label;
          usedModel = attempt.model;
          break;
        } catch (error: any) {
          console.error(`❌ 9router failed (PRD ${attempt.model}):`, error?.message?.substring(0, 200));
          lastError = error;
        }
      }

      if (!response) {
        throw lastError;
      }

      const markdown = response.choices[0]?.message?.content || '';
      console.log('✅ PRD berhasil di-generate!');

      // ═══════════ USAGE LOG ═══════════
      await prisma.usageLog.create({ data: { userId, type: 'PRD_GENERATE' } }).catch(() => {});
      // ═══════════════════════════════════════

      // ═══════════ AUTO-SAVE BLUEPRINT ═══════════
      let savedBlueprintId: string | null = null;
      try {
        const savedBlueprint = await prisma.blueprint.create({
          data: {
            userId,
            name: projectName || 'Untitled PRD',
            type: projectType || 'Fullstack Web App',
            content: markdown,
          }
        });
        savedBlueprintId = savedBlueprint.id;
        await createBlueprintVersion({
          blueprintId: savedBlueprint.id,
          userId,
          name: savedBlueprint.name,
          content: savedBlueprint.content,
          source: 'GENERATE',
        }).catch(() => {});
        console.log('💾 Blueprint auto-saved to database.');
      } catch (saveErr: any) {
        console.error('⚠️ Failed to auto-save blueprint:', saveErr?.message);
        // Don't fail the whole request if save fails
      }
      // ═══════════════════════════════════════════

      // Get fresh quota info to send back
      const freshQuota = await checkQuota(userId);

      await recordAiRequest({
        userId,
        type: 'PRD_GENERATE',
        provider: '9router',
        model: `${usedModelLabel}:${usedModel}`,
        status: 'SUCCESS',
        durationMs: Date.now() - requestStartedAt,
      });
      await recordAuditLog({
        userId,
        action: 'PRD_GENERATE',
        targetType: 'Blueprint',
        targetId: savedBlueprintId,
        metadata: { projectType, projectName, requestedModel: modelSelection || 'PRD Thinking', usedModelLabel, usedModel },
        req,
      });

      res.json({
        markdown,
        blueprintId: savedBlueprintId,
        quota: {
          remaining: freshQuota.remaining,
          limit: freshQuota.limit,
          plan: freshQuota.planType,
        },
        model: {
          requested: modelSelection || 'PRD Thinking',
          usedLabel: usedModelLabel,
          used: usedModel,
        },
      });
      claimedQuota = null;

    } catch (error: any) {
      console.error('❌ Error generating PRD:', error?.message || error);
      if (claimedQuota) await refundQuota(claimedQuota, 'prd').catch(() => {});
      await recordAiRequest({
        userId: requestUserId,
        type: 'PRD_GENERATE',
        provider: 'auto',
        status: 'FAILED',
        durationMs: Date.now() - requestStartedAt,
        error: error?.message || 'Unknown error',
      });
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      if (error?.status === 429) {
        return res.status(429).json({ error: 'Rate limit AI tercapai. Tunggu beberapa detik lalu coba lagi.' });
      }
      if (error?.status === 413 || error?.message?.includes('413')) {
        return res.status(413).json({ error: 'Deskripsi proyek terlalu panjang untuk diproses. Coba persingkat deskripsi Anda.' });
      }
      if (error?.status === 401) {
        return res.status(401).json({ error: 'API Key AI tidak valid. Periksa konfigurasi server.' });
      }

      // S-07: Jangan leak internal error detail ke client
      res.status(500).json({ error: 'Gagal menghasilkan PRD. Coba lagi atau pilih model yang berbeda.' });
    }
  });

  // Server-side proxy for PRD AI Revision (with Prompt Caching)
  app.post('/api/revise-prd', requireAuth, async (req: any, res: any) => {
    let claimedQuota: string | null = null;
    let requestUserId: string | null = null;
    const requestStartedAt = Date.now();
    try {
      const body = asObject(req.body);
      if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

      const blueprintId = readString(body, 'blueprintId', { required: true, max: 80 });
      const currentContent = readString(body, 'currentContent', { required: true, max: 50000 });
      const revisionPrompt = readString(body, 'revisionPrompt', { required: true, max: 2000 });
      const modelSelection = readString(body, 'modelSelection', { max: 80 });
      const userId = req.user.userId;
      requestUserId = userId;

      const sub = await getActiveSubscription(userId);
      if (!sub || (sub.planType !== 'PRO' && sub.planType !== 'PRO_MAX')) {
        return res.status(403).json({ error: 'Fitur revisi AI hanya tersedia untuk paket Pro dan Pro Max. Silakan upgrade plan Anda.' });
      }

      const blueprint = await prisma.blueprint.findFirst({
        where: { id: blueprintId, userId }
      });
      if (!blueprint) {
        return res.status(404).json({ error: 'Blueprint not found' });
      }

      const quota = await claimQuota(userId, 'prd');
      if (!quota.allowed) {
        return res.status(403).json({ error: `Kuota harian habis (${quota.limit}/${quota.limit}). Upgrade plan Anda.`, quotaExhausted: true });
      }
      claimedQuota = quota.subscriptionId;

      /* ═══════════ PROMPT CACHING ═══════════
         Instead of sending the FULL PRD (3000-5000 tokens) every time,
         we send a compact summary (~500 tokens) for context, plus ONLY
         the user's revision instruction. This cuts TPM usage by ~70%.
      ═══════════════════════════════════════ */
      const prdSummary = currentContent
        .split('\n')
        .filter((line: string) => line.startsWith('#') || line.startsWith('- ') || line.startsWith('## '))
        .slice(0, 40)
        .join('\n');

      const prompt = `Kamu Tech Lead senior. Revisi PRD berikut berdasarkan instruksi pengguna.

RINGKASAN STRUKTUR PRD (cached):
${prdSummary}

KONTEN PRD LENGKAP:
${currentContent.substring(0, 6000)}

INSTRUKSI REVISI:
"${revisionPrompt}"

Output HANYA Markdown murni (tanpa \`\`\`markdown wrapper). Pertahankan struktur heading yang ada kecuali diminta mengubah. Pertahankan Mermaid diagram yang relevan.`;

      console.log(`📡 Mengirim request revisi PRD... (Model: ${modelSelection || 'PRD Thinking'})`);
      let response;
      let lastError: any;
      let usedReviseLabel = modelSelection || 'PRD Thinking';
      let usedReviseModel = ROUTER9_MODEL_MAP[usedReviseLabel] ?? ROUTER9_MODEL_MAP['PRD Thinking'];

      const reviseMessages = [
        { role: 'system' as const, content: 'Kamu adalah Tech Lead senior. Hasilkan output PRD dalam format Markdown murni. PASTIKAN SINTAKS MERMAID TETAP VALID.' },
        { role: 'user' as const, content: prompt },
      ];

      const reviseAttempts = getPrdModelAttempts(modelSelection || 'PRD Thinking');
      for (const attempt of reviseAttempts) {
        const r9revise = router9Config(attempt.maxTokens, attempt.model);
        if (!r9revise) throw new Error('9router belum dikonfigurasi.');

        try {
          const client = new OpenAI({ baseURL: r9revise.baseURL, apiKey: r9revise.apiKey, timeout: attempt.timeoutMs });
          if (attempt.isPowerModel) {
            const stream = await client.chat.completions.create({
              model: r9revise.model,
              messages: reviseMessages,
              temperature: 0.4,
              max_tokens: r9revise.maxTokens,
              stream: true,
            });
            let fullContent = '';
            for await (const chunk of stream) {
              fullContent += chunk.choices[0]?.delta?.content || '';
            }
            response = { choices: [{ message: { content: fullContent } }] } as any;
          } else {
            response = await client.chat.completions.create({
              model: r9revise.model,
              messages: reviseMessages,
              temperature: 0.4,
              max_tokens: r9revise.maxTokens,
            });
          }
          usedReviseLabel = attempt.label;
          usedReviseModel = attempt.model;
          break;
        } catch (error: any) {
          console.error(`❌ 9router failed (revise ${attempt.model}):`, error?.message?.substring(0, 120));
          lastError = error;
        }
      }

      if (!response) throw lastError;

      const newContent = response.choices[0]?.message?.content || '';

      const updated = await prisma.blueprint.update({
        where: { id: blueprintId },
        data: { content: newContent }
      });

      await createBlueprintVersion({
        blueprintId: updated.id,
        userId,
        name: updated.name,
        content: updated.content,
        source: 'AI_REVISE',
      }).catch(() => {});

      await prisma.usageLog.create({ data: { userId, type: 'PRD_REVISE' } }).catch(() => {});
      await recordAiRequest({
        userId,
        type: 'PRD_REVISE',
        provider: '9router',
        model: `${usedReviseLabel}:${usedReviseModel}`,
        status: 'SUCCESS',
        durationMs: Date.now() - requestStartedAt,
      });
      await recordAuditLog({
        userId,
        action: 'PRD_REVISE',
        targetType: 'Blueprint',
        targetId: updated.id,
        metadata: { promptLength: revisionPrompt.length, requestedModel: modelSelection || 'PRD Thinking', usedReviseLabel, usedReviseModel },
        req,
      });

      const freshBlueprint = await getBlueprintRow(updated.id, userId);
      res.json({
        success: true,
        blueprint: freshBlueprint || updated,
        model: {
          requested: modelSelection || 'PRD Thinking',
          usedLabel: usedReviseLabel,
          used: usedReviseModel,
        },
      });
      claimedQuota = null;
    } catch (error: any) {
      console.error('❌ Error revising PRD:', error?.message || error);
      if (claimedQuota) await refundQuota(claimedQuota, 'prd').catch(() => {});
      await recordAiRequest({
        userId: requestUserId,
        type: 'PRD_REVISE',
        provider: 'auto',
        status: 'FAILED',
        durationMs: Date.now() - requestStartedAt,
        error: error?.message || 'Unknown error',
      });
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (error?.status === 413 || error?.message?.includes('413')) {
        return res.status(413).json({ error: 'PRD terlalu panjang. Coba hapus beberapa bagian lalu revisi kembali.' });
      }
      res.status(500).json({ error: 'Gagal merevisi PRD.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // STREAMING Code Generation Endpoint (SSE) — Bolt.new Architecture
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/generate-code', requireAuth, async (req: any, res: any) => {
    let claimedQuota: string | null = null;
    let requestUserId: string | null = null;
    const requestStartedAt = Date.now();
    try {
      const body = asObject(req.body);
      if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

      const systemInstruction = readString(body, 'systemInstruction', { required: true, max: 12000 });
      const messages = readChatMessages(body);
      const useStreaming = readBoolean(body, 'useStreaming', false);
      const modelSelection = readString(body, 'modelSelection', { max: 80 });
      const userId = req.user.userId;
      requestUserId = userId;

      const totalInputChars = systemInstruction.length + messages.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
      if (totalInputChars > 30000) {
        console.warn(`⚠️ Code gen input too large: ${totalInputChars} chars. Truncating.`);
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.content && lastMsg.content.length > 5000) {
          lastMsg.content = lastMsg.content.substring(0, 5000) + '\n\n[...CONTENT TRUNCATED BY SERVER...]';
        }
      }

      // Resolve provider attempts before claiming quota.
      const codeAttempts = getCodeModelAttempts(modelSelection);
      if (!router9Config()) {
        return res.status(400).json({ error: '9router belum dikonfigurasi (ROUTER9_API_KEY dan ROUTER9_BASE_URL).' });
      }

      // ═══════════ ATOMIC QUOTA CLAIM ═══════════
      const quota = await claimQuota(userId, 'code');
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Kuota AI Code harian habis (${quota.limit}/${quota.limit}). Upgrade plan Anda.`,
          quotaExhausted: true,
        });
      }
      claimedQuota = quota.subscriptionId;

      // ═══════════ STREAMING MODE ═══════════
      if (useStreaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        let lastError: any;
        let streamSuccess = false;
        let wroteChunk = false;
        let usedCodeLabel = modelSelection || 'Gemini 3.5 Flash';
        let usedCodeModel = ROUTER9_MODEL_MAP[usedCodeLabel] ?? ROUTER9_MODEL_MAP['Gemini 3.5 Flash'];

        const runStream = async (client: OpenAI, model: string, maxTokens: number, label: string) => {
          console.log(`🔄 Streaming code gen via ${label}...`);
          const stream = await client.chat.completions.create({
            model,
            messages: [{ role: 'system', content: systemInstruction }, ...messages],
            temperature: 0.2,
            max_tokens: maxTokens,
            stream: true,
          });
          for await (const chunk of stream) {
            // E-01: Hentikan streaming jika client sudah disconnect
            if (res.destroyed) { stream.controller.abort(); break; }
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              wroteChunk = true;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
            }
            const finishReason = chunk.choices[0]?.finish_reason;
            if (finishReason) res.write(`data: ${JSON.stringify({ type: 'finish', reason: finishReason })}\n\n`);
          }
        };

        for (const attempt of codeAttempts) {
          const r9 = router9Config(attempt.maxTokens, attempt.model);
          if (!r9) {
            lastError = new Error('9router tidak dikonfigurasi.');
            break;
          }
          const hadWrittenChunkBeforeAttempt = wroteChunk;
          try {
            const client = new OpenAI({ baseURL: r9.baseURL, apiKey: r9.apiKey, timeout: 120000 });
            const label = `9router:${attempt.model}`;
            await runStream(client, r9.model, r9.maxTokens, label);
            usedCodeLabel = attempt.label;
            usedCodeModel = attempt.model;
            streamSuccess = true;
            res.write(`data: ${JSON.stringify({
              type: 'model',
              requested: modelSelection || 'Gemini 3.5 Flash',
              usedLabel: usedCodeLabel,
              used: usedCodeModel,
            })}\n\n`);
            break;
          } catch (error: any) {
            console.error(`9router:${attempt.model} failed (stream):`, error?.message?.substring(0, 100));
            lastError = error;
            if (wroteChunk || hadWrittenChunkBeforeAttempt) break;
          }
        }

        if (!streamSuccess) {
          await refundQuota(quota.subscriptionId, 'code');
          claimedQuota = null;
          await recordAiRequest({
            userId,
            type: 'CODE_GENERATE',
            provider: '9router',
            model: usedCodeModel,
            status: 'FAILED',
            durationMs: Date.now() - requestStartedAt,
            error: lastError?.message || 'All API keys failed',
          });
          res.write(`data: ${JSON.stringify({ type: 'error', message: publicCodeGenerationError(lastError) })}\n\n`);
        } else {
          await prisma.usageLog.create({ data: { userId, type: 'CODE_GENERATE' } }).catch(() => {});
          await recordAiRequest({
            userId,
            type: 'CODE_GENERATE',
            provider: '9router',
            model: `${usedCodeLabel}:${usedCodeModel}`,
            status: 'SUCCESS',
            durationMs: Date.now() - requestStartedAt,
          });
          await recordAuditLog({
            userId,
            action: 'CODE_GENERATE',
            targetType: 'CodeProject',
            metadata: { streaming: true, requestedModel: modelSelection || 'Gemini 3.5 Flash', usedCodeLabel, usedCodeModel },
            req,
          });
          claimedQuota = null;
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }

      // ═══════════ LEGACY BATCH MODE (fallback, non-streaming) ═══════════
      let response;
      let lastError: any;
      let usedCodeLabel = modelSelection || 'Gemini 3.5 Flash';
      let usedCodeModel = ROUTER9_MODEL_MAP[usedCodeLabel] ?? ROUTER9_MODEL_MAP['Gemini 3.5 Flash'];

      const runBatch = async (client: OpenAI, model: string, maxTokens: number) => {
        const r = await client.chat.completions.create({
          model,
          messages: [{ role: 'system', content: systemInstruction }, ...messages],
          temperature: 0.2,
          max_tokens: maxTokens,
        });
        if (r.choices?.[0]?.finish_reason === 'length') {
          console.warn(`⚠️ Code gen output TRUNCATED (finish_reason=length).`);
        }
        return r;
      };

      for (const attempt of codeAttempts) {
        const r9 = router9Config(attempt.maxTokens, attempt.model);
        if (!r9) {
          lastError = new Error('9router tidak dikonfigurasi (ROUTER9_API_KEY / ROUTER9_BASE_URL).');
          break;
        }
        try {
          const client = new OpenAI({ baseURL: r9.baseURL, apiKey: r9.apiKey, timeout: 120000 });
          response = await runBatch(client, r9.model, r9.maxTokens);
          usedCodeLabel = attempt.label;
          usedCodeModel = attempt.model;
          break;
        } catch (error: any) {
          console.error(`9router:${attempt.model} failed:`, error?.message?.substring(0, 100));
          lastError = error;
        }
      }

      if (!response) {
        throw lastError;
      }

      await prisma.usageLog.create({ data: { userId, type: 'CODE_GENERATE' } }).catch(() => {});
      await recordAiRequest({
        userId,
        type: 'CODE_GENERATE',
        provider: '9router',
        model: `${usedCodeLabel}:${usedCodeModel}`,
        status: 'SUCCESS',
        durationMs: Date.now() - requestStartedAt,
      });
      await recordAuditLog({
        userId,
        action: 'CODE_GENERATE',
        targetType: 'CodeProject',
        metadata: { streaming: false, requestedModel: modelSelection || 'Gemini 3.5 Flash', usedCodeLabel, usedCodeModel },
        req,
      });

      res.json(response);
      claimedQuota = null;
    } catch (error: any) {
      console.error('❌ Error generating code:', error?.message || error);
      if (claimedQuota) await refundQuota(claimedQuota, 'code').catch(() => {});
      await recordAiRequest({
        userId: requestUserId,
        type: 'CODE_GENERATE',
        provider: 'auto',
        status: 'FAILED',
        durationMs: Date.now() - requestStartedAt,
        error: error?.message || 'Unknown error',
      });
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (error?.status === 429) {
        return res.status(429).json({ error: 'Rate limit tercapai. Tunggu beberapa detik.' });
      }
      if (error?.status === 413 || error?.message?.includes('too large') || error?.message?.includes('token')) {
        return res.status(413).json({ error: 'Input terlalu panjang untuk diproses. Coba persingkat instruksi.' });
      }
      res.status(500).json({ error: publicCodeGenerationError(error) });
    }
  });

  // ═══════════ USER PROFILE (fresh from DB) ═══════════
  app.get('/api/user/profile', requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const sub = await getActiveSubscription(userId);
      const planLimits: Record<string, { prd: number, code: number }> = {
        'FREE': { prd: 1, code: 5 },
        'PRO': { prd: 5, code: 50 },
        'PRO_MAX': { prd: 999999, code: 999999 }
      };

      const planType = sub?.planType || 'FREE';
      const limit = planLimits[planType]?.prd ?? 1;
      const codeLimit = planLimits[planType]?.code ?? 5;

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        csrfToken: req.user.csrfToken,
        plan: planType,
        quota: {
          remaining: Math.max(0, limit - (sub?.quotaUsedToday || 0)),
          limit,
          usedToday: sub?.quotaUsedToday || 0,
        },
        codeQuota: {
          remaining: Math.max(0, codeLimit - (sub?.codeQuotaUsedToday || 0)),
          limit: codeLimit,
          usedToday: sub?.codeQuotaUsedToday || 0,
        }
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  // 404 for unknown API routes (must be JSON, not SPA HTML)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global error handler (last middleware)
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('💥 Unhandled error:', err?.message || err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
  });

  return app;
}

async function startServer() {
  assertValidEnvironment();

  const backfilledVersions = await backfillMissingBlueprintVersions().catch((error) => {
    console.error('⚠️ Failed to backfill blueprint versions:', error?.message || error);
    return 0;
  });
  if (backfilledVersions > 0) {
    console.log(`🧾 Backfilled ${backfilledVersions} blueprint version record(s).`);
  }
  await enforceLogRetention().catch((error) => {
    console.error('⚠️ Failed to enforce log retention:', error?.message || error);
  });

  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      clearScreen: false, // Hindari error "clearScreenDown is not yet implemented" di non-TTY
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log('🤖 Default model: Gemini 3.5 Flash via 9router');
    console.log('🧠 PRD Max: GPT-5.5 | Code: Gemini 3.5 Flash / Gemini 3.1 Pro / Claude Sonnet 4.6 / Claude Opus 4.6\n');
  });
  // Allow long-running 9router model requests.
  server.timeout = 300000; // 5 minutes
  server.keepAliveTimeout = 300000;
}

startServer();
