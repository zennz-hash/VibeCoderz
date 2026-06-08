import crypto from 'node:crypto';
import prisma from '../../src/utils/prisma';

type RequestLike = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

function safeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const json = JSON.stringify(value);
    return json.length > 8000 ? json.slice(0, 8000) : json;
  } catch {
    return null;
  }
}

function userAgent(req?: RequestLike): string | null {
  const raw = req?.headers?.['user-agent'];
  if (Array.isArray(raw)) return raw.join(' ').slice(0, 500);
  return raw ? raw.slice(0, 500) : null;
}

export async function recordAuditLog(params: {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  req?: RequestLike;
}) {
  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO AuditLog (id, userId, action, targetType, targetId, metadata, ip, userAgent, createdAt)
    VALUES (
      ${id},
      ${params.userId || null},
      ${params.action},
      ${params.targetType || null},
      ${params.targetId || null},
      ${safeJson(params.metadata)},
      ${params.req?.ip || null},
      ${userAgent(params.req)},
      ${new Date()}
    )
  `.catch((err: unknown) => {
    console.error('[audit] recordAuditLog failed:', (err as any)?.message || err);
  });
}

export async function recordAiRequest(params: {
  userId?: string | null;
  type: string;
  provider?: string | null;
  model?: string | null;
  status: 'SUCCESS' | 'FAILED';
  durationMs?: number | null;
  error?: string | null;
}) {
  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO AiRequestLog (id, userId, type, provider, model, status, durationMs, error, createdAt)
    VALUES (
      ${id},
      ${params.userId || null},
      ${params.type},
      ${params.provider || null},
      ${params.model || null},
      ${params.status},
      ${params.durationMs ?? null},
      ${params.error ? params.error.slice(0, 1000) : null},
      ${new Date()}
    )
  `.catch((err: unknown) => {
    console.error('[audit] recordAiRequest failed:', (err as any)?.message || err);
  });
}
