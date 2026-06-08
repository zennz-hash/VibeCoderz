import prisma from '../../src/utils/prisma';

/**
 * Plan limits configuration
 * FREE = 1 PRD/day, 5 Code/day
 * PRO = 5 PRD/day, 50 Code/day
 * PRO_MAX = unlimited
 */
const PLAN_LIMITS: Record<string, { prd: number, code: number }> = {
  'FREE': { prd: 1, code: 5 },
  'PRO': { prd: 5, code: 50 },
  'PRO_MAX': { prd: 999999, code: 999999 }, // effectively unlimited
};

export type QuotaKind = 'prd' | 'code';

export function getQuotaLimit(planType: string, kind: QuotaKind): number {
  return PLAN_LIMITS[planType]?.[kind] ?? PLAN_LIMITS['FREE'][kind];
}

export function calculateRemaining(planType: string, usedToday: number, kind: QuotaKind): number {
  return Math.max(0, getQuotaLimit(planType, kind) - usedToday);
}

export function isSubscriptionExpired(activeUntil: Date | null): boolean {
  return Boolean(activeUntil && activeUntil <= new Date());
}

/**
 * Check if a new day has started since last quota reset.
 * Menggunakan UTC+7 (Asia/Jakarta) tanpa mutasi Date object.
 */
function isNewDay(lastReset: Date): boolean {
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

  const nowLocal  = new Date(Date.now() + TZ_OFFSET_MS);
  const lastLocal = new Date(new Date(lastReset).getTime() + TZ_OFFSET_MS);

  return nowLocal.getUTCFullYear() !== lastLocal.getUTCFullYear()
    || nowLocal.getUTCMonth()     !== lastLocal.getUTCMonth()
    || nowLocal.getUTCDate()      !== lastLocal.getUTCDate();
}

/**
 * Get the user's active subscription, auto-reset daily quota if needed.
 * Returns the subscription with fresh quota info.
 */
export async function getActiveSubscription(userId: string) {
  await prisma.planSubscription.updateMany({
    where: {
      userId,
      status: 'ACTIVE',
      activeUntil: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  let sub = await prisma.planSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' } // Deterministik: ambil subscription ACTIVE terbaru bila ada duplikat
  });

  // Jika user belum punya subscription, buat FREE otomatis agar /profile & checkQuota konsisten.
  if (!sub) {
    try {
      sub = await prisma.planSubscription.create({
        data: { userId, planType: 'FREE', status: 'ACTIVE', prdQuota: PLAN_LIMITS['FREE'].prd },
      });
    } catch {
      return null; // mis. userId tidak valid (FK) — biarkan pemanggil menangani
    }
  }

  // Auto-reset quota if a new day has started
  if (isNewDay(sub.lastQuotaReset)) {
    sub = await prisma.planSubscription.update({
      where: { id: sub.id },
      data: {
        quotaUsedToday: 0,
        codeQuotaUsedToday: 0,
        lastQuotaReset: new Date(),
      }
    });
  }

  return sub;
}

/**
 * Check if user has remaining PRD quota for today.
 */
export async function checkQuota(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  planType: string;
  subscriptionId: string;
}> {
  const sub = await getActiveSubscription(userId);

  if (!sub) {
    return { allowed: false, remaining: 0, limit: 0, planType: 'NONE', subscriptionId: '' };
  }

  const limit = getQuotaLimit(sub.planType, 'prd');
  const remaining = calculateRemaining(sub.planType, sub.quotaUsedToday, 'prd');

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    planType: sub.planType,
    subscriptionId: sub.id,
  };
}

/**
 * Consume one unit of PRD quota.
 */
export async function consumeQuota(subscriptionId: string): Promise<void> {
  await prisma.planSubscription.update({
    where: { id: subscriptionId },
    data: {
      quotaUsedToday: { increment: 1 },
    }
  });
}

/**
 * Atomically reserve one quota unit. This prevents parallel requests from
 * passing checkQuota at the same time and over-consuming the daily limit.
 */
export async function claimQuota(userId: string, kind: QuotaKind): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  planType: string;
  subscriptionId: string;
}> {
  const sub = await getActiveSubscription(userId);
  if (!sub) {
    return { allowed: false, remaining: 0, limit: 0, planType: 'NONE', subscriptionId: '' };
  }

  const limit = getQuotaLimit(sub.planType, kind);
  const field = kind === 'prd' ? 'quotaUsedToday' : 'codeQuotaUsedToday';
  const usedToday = kind === 'prd' ? sub.quotaUsedToday : sub.codeQuotaUsedToday;

  if (usedToday >= limit) {
    return { allowed: false, remaining: 0, limit, planType: sub.planType, subscriptionId: sub.id };
  }

  const updatedCount = await prisma.planSubscription.updateMany({
    where: {
      id: sub.id,
      [field]: { lt: limit },
    },
    data: {
      [field]: { increment: 1 },
    },
  });

  if (updatedCount.count === 0) {
    const fresh = await prisma.planSubscription.findUnique({ where: { id: sub.id } });
    const freshUsed = kind === 'prd' ? fresh?.quotaUsedToday ?? limit : fresh?.codeQuotaUsedToday ?? limit;
    return {
      allowed: false,
      remaining: Math.max(0, limit - freshUsed),
      limit,
      planType: sub.planType,
      subscriptionId: sub.id,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - usedToday - 1),
    limit,
    planType: sub.planType,
    subscriptionId: sub.id,
  };
}

export async function refundQuota(subscriptionId: string, kind: QuotaKind): Promise<void> {
  const field = kind === 'prd' ? 'quotaUsedToday' : 'codeQuotaUsedToday';
  await prisma.planSubscription.updateMany({
    where: {
      id: subscriptionId,
      [field]: { gt: 0 },
    },
    data: {
      [field]: { decrement: 1 },
    },
  });
}

/**
 * Check if user has remaining CODE quota for today.
 */
export async function checkCodeQuota(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  planType: string;
  subscriptionId: string;
}> {
  const sub = await getActiveSubscription(userId);

  if (!sub) {
    return { allowed: false, remaining: 0, limit: 0, planType: 'NONE', subscriptionId: '' };
  }

  const limit = getQuotaLimit(sub.planType, 'code');
  const remaining = calculateRemaining(sub.planType, sub.codeQuotaUsedToday, 'code');

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    planType: sub.planType,
    subscriptionId: sub.id,
  };
}

/**
 * Consume one unit of CODE quota.
 */
export async function consumeCodeQuota(subscriptionId: string): Promise<void> {
  await prisma.planSubscription.update({
    where: { id: subscriptionId },
    data: {
      codeQuotaUsedToday: { increment: 1 },
    }
  });
}
