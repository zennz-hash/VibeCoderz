import { Router } from 'express';
import prisma from '../../src/utils/prisma';
import crypto from 'node:crypto';
import { requireAdmin } from './auth';
import { ValidationError, asObject, readString } from '../utils/validation';
import { recordAuditLog } from '../utils/audit';

const router = Router();

const ADMIN_PLAN_LIMITS: Record<string, { prd: number; code: number }> = {
  FREE: { prd: 1, code: 5 },
  PRO: { prd: 5, code: 50 },
  PRO_MAX: { prd: 999999, code: 999999 },
};

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
  createdAt: Date | string;
  planType: string | null;
  status: string | null;
  quotaUsedToday: number | bigint | null;
  codeQuotaUsedToday: number | bigint | null;
  blueprintCount: number | bigint;
};

function readPageQuery(req: any) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

function readEnumQuery(req: any, key: string, allowed: string[]) {
  const raw = String(req.query[key] || '').trim().toUpperCase();
  return allowed.includes(raw) ? raw : '';
}

router.get('/overview', requireAdmin, async (_req: any, res) => {
  try {
    const [users, blueprints, usageToday, codeProjects, failedAi] = await Promise.all([
      prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM User`,
      prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM Blueprint`,
      prisma.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count
        FROM UsageLog
        WHERE createdAt >= datetime('now', 'start of day')
      `,
      prisma.$queryRaw<Array<{ count: number | bigint }>>`SELECT COUNT(*) AS count FROM CodeProject`,
      prisma.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count
        FROM AiRequestLog
        WHERE status = 'FAILED'
          AND createdAt >= datetime('now', '-7 days')
      `,
    ]);

    res.json({
      users: Number(users[0]?.count || 0),
      blueprints: Number(blueprints[0]?.count || 0),
      usageToday: Number(usageToday[0]?.count || 0),
      codeProjects: Number(codeProjects[0]?.count || 0),
      failedAiLast7Days: Number(failedAi[0]?.count || 0),
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

router.get('/users', requireAdmin, async (req: any, res) => {
  const { limit, page, offset } = readPageQuery(req);
  const search = String(req.query.search || '').trim();
  const role = readEnumQuery(req, 'role', ['USER', 'ADMIN']);
  const planType = readEnumQuery(req, 'planType', ['FREE', 'PRO', 'PRO_MAX']);
  const searchLike = `%${search}%`;

  const totalRows = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS count
    FROM User u
    WHERE 1 = 1
      AND (${search} = '' OR u.email LIKE ${searchLike} OR COALESCE(u.name, '') LIKE ${searchLike})
      AND (${role} = '' OR u.role = ${role})
      AND (${planType} = '' OR COALESCE((
        SELECT latest.planType
        FROM PlanSubscription latest
        WHERE latest.userId = u.id
          AND latest.status = 'ACTIVE'
        ORDER BY latest.createdAt DESC
        LIMIT 1
      ), 'FREE') = ${planType})
  `;

  const rows = await prisma.$queryRaw<AdminUserRow[]>`
    SELECT
      u.id,
      u.email,
      u.name,
      u.picture,
      u.role,
      u.createdAt,
      ps.planType,
      ps.status,
      ps.quotaUsedToday,
      ps.codeQuotaUsedToday,
      COUNT(b.id) AS blueprintCount
    FROM User u
    LEFT JOIN PlanSubscription ps
      ON ps.id = (
        SELECT latest.id
        FROM PlanSubscription latest
        WHERE latest.userId = u.id
          AND latest.status = 'ACTIVE'
        ORDER BY latest.createdAt DESC
        LIMIT 1
      )
    LEFT JOIN Blueprint b ON b.userId = u.id
    WHERE 1 = 1
      AND (${search} = '' OR u.email LIKE ${searchLike} OR COALESCE(u.name, '') LIKE ${searchLike})
      AND (${role} = '' OR u.role = ${role})
      AND (${planType} = '' OR COALESCE((
        SELECT latest.planType
        FROM PlanSubscription latest
        WHERE latest.userId = u.id
          AND latest.status = 'ACTIVE'
        ORDER BY latest.createdAt DESC
        LIMIT 1
      ), 'FREE') = ${planType})
    GROUP BY u.id
    ORDER BY u.createdAt DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  const total = Number(totalRows[0]?.count || 0);
  res.json({
    items: rows.map((row) => ({
      ...row,
      quotaUsedToday: Number(row.quotaUsedToday || 0),
      codeQuotaUsedToday: Number(row.codeQuotaUsedToday || 0),
      blueprintCount: Number(row.blueprintCount || 0),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

router.patch('/users/:id/role', requireAdmin, async (req: any, res) => {
  try {
    const body = asObject(req.body);
    if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });
    const role = readString(body, 'role', { required: true, max: 20 }).toUpperCase();
    if (role !== 'USER' && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Role harus USER atau ADMIN.' });
    }

    // Cegah admin mendemote dirinya sendiri
    if (req.params.id === req.user.userId && role === 'USER') {
      return res.status(400).json({ error: 'Tidak bisa mendemote diri sendiri. Minta admin lain untuk mengubah role Anda.' });
    }

    // Jika demote ke USER, pastikan masih ada minimal 1 admin lain
    if (role === 'USER') {
      const adminCount = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count FROM User WHERE role = 'ADMIN' AND id != ${req.params.id}
      `;
      if (Number(adminCount[0]?.count || 0) === 0) {
        return res.status(400).json({ error: 'Tidak bisa mendemote admin terakhir. Pastikan ada admin lain sebelum mengubah role ini.' });
      }
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true },
    });

    await recordAuditLog({
      userId: req.user.userId,
      action: 'ADMIN_USER_ROLE_UPDATE',
      targetType: 'User',
      targetId: req.params.id,
      metadata: { role },
      req,
    });

    res.json({ success: true, role });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.patch('/users/:id/plan', requireAdmin, async (req: any, res) => {
  try {
    const body = asObject(req.body);
    if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

    const planType = readString(body, 'planType', { required: true, max: 20 }).toUpperCase();
    const limits = ADMIN_PLAN_LIMITS[planType];
    if (!limits) {
      return res.status(400).json({ error: 'Plan harus FREE, PRO, atau PRO_MAX.' });
    }

    const users = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email
      FROM User
      WHERE id = ${req.params.id}
      LIMIT 1
    `;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const activeRows = await prisma.$queryRaw<Array<{ planType: string | null }>>`
      SELECT planType
      FROM PlanSubscription
      WHERE userId = ${req.params.id}
        AND status = 'ACTIVE'
      ORDER BY createdAt DESC
      LIMIT 1
    `;
    const previousPlan = activeRows[0]?.planType || null;

    await prisma.$executeRaw`
      UPDATE PlanSubscription
      SET status = 'CANCELLED',
          activeUntil = ${new Date()},
          updatedAt = ${new Date()}
      WHERE userId = ${req.params.id}
        AND status = 'ACTIVE'
    `;

    const subscriptionId = crypto.randomUUID();
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO PlanSubscription (
        id,
        userId,
        planType,
        status,
        prdQuota,
        quotaUsedToday,
        codeQuotaUsedToday,
        lastQuotaReset,
        activeUntil,
        createdAt,
        updatedAt
      )
      VALUES (
        ${subscriptionId},
        ${req.params.id},
        ${planType},
        'ACTIVE',
        ${limits.prd},
        0,
        0,
        ${now},
        NULL,
        ${now},
        ${now}
      )
    `;

    await recordAuditLog({
      userId: req.user.userId,
      action: 'ADMIN_USER_PLAN_UPDATE',
      targetType: 'User',
      targetId: req.params.id,
      metadata: { email: user.email, previousPlan, planType, limits },
      req,
    });

    res.json({ success: true, planType, limits });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    console.error('Failed to update plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.post('/users/:id/reset-quota', requireAdmin, async (req: any, res) => {
  await prisma.planSubscription.updateMany({
    where: { userId: req.params.id, status: 'ACTIVE' },
    data: {
      quotaUsedToday: 0,
      codeQuotaUsedToday: 0,
      lastQuotaReset: new Date(),
    },
  });

  await recordAuditLog({
    userId: req.user.userId,
    action: 'ADMIN_USER_QUOTA_RESET',
    targetType: 'User',
    targetId: req.params.id,
    req,
  });

  res.json({ success: true });
});

router.get('/audit-logs', requireAdmin, async (_req: any, res) => {
  const rows = await prisma.$queryRaw`
    SELECT
      a.id,
      a.userId,
      u.email,
      a.action,
      a.targetType,
      a.targetId,
      a.metadata,
      a.ip,
      a.createdAt
    FROM AuditLog a
    LEFT JOIN User u ON u.id = a.userId
    ORDER BY a.createdAt DESC
    LIMIT 200
  `;
  res.json(rows);
});

router.get('/ai-requests', requireAdmin, async (_req: any, res) => {
  const rows = await prisma.$queryRaw`
    SELECT
      r.id,
      r.userId,
      u.email,
      r.type,
      r.provider,
      r.model,
      r.status,
      r.durationMs,
      r.error,
      r.createdAt
    FROM AiRequestLog r
    LEFT JOIN User u ON u.id = r.userId
    ORDER BY r.createdAt DESC
    LIMIT 200
  `;
  res.json(rows);
});

export default router;
