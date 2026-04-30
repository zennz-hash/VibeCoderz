import prisma from '../../src/utils/prisma';

/**
 * Plan limits configuration
 * FREE = 1 PRD/day, STARTER = 5 PRD/day, PRO = unlimited
 */
const PLAN_LIMITS: Record<string, number> = {
  'FREE': 1,
  'STARTER': 5,
  'PRO': 999999, // effectively unlimited
};

/**
 * Check if a new day has started since last quota reset.
 * If so, reset quotaUsedToday to 0.
 */
function isNewDay(lastReset: Date): boolean {
  const now = new Date();
  const last = new Date(lastReset);
  return now.getUTCFullYear() !== last.getUTCFullYear()
    || now.getUTCMonth() !== last.getUTCMonth()
    || now.getUTCDate() !== last.getUTCDate();
}

/**
 * Get the user's active subscription, auto-reset daily quota if needed.
 * Returns the subscription with fresh quota info.
 */
export async function getActiveSubscription(userId: string) {
  let sub = await prisma.planSubscription.findFirst({
    where: { userId, status: 'ACTIVE' }
  });

  if (!sub) return null;

  // Auto-reset quota if a new day has started
  if (isNewDay(sub.lastQuotaReset)) {
    sub = await prisma.planSubscription.update({
      where: { id: sub.id },
      data: {
        quotaUsedToday: 0,
        lastQuotaReset: new Date(),
      }
    });
  }

  return sub;
}

/**
 * Check if user has remaining quota for today.
 * Returns { allowed, remaining, limit, planType } or throws descriptive error.
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

  const limit = PLAN_LIMITS[sub.planType] ?? PLAN_LIMITS['FREE'];
  const remaining = Math.max(0, limit - sub.quotaUsedToday);

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    planType: sub.planType,
    subscriptionId: sub.id,
  };
}

/**
 * Consume one unit of quota. Call this AFTER a successful PRD generation.
 */
export async function consumeQuota(subscriptionId: string): Promise<void> {
  await prisma.planSubscription.update({
    where: { id: subscriptionId },
    data: {
      quotaUsedToday: { increment: 1 },
    }
  });
}
