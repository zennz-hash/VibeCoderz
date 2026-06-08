import crypto from 'node:crypto';
import { Router } from 'express';
import prisma from '../../src/utils/prisma';
import { requireAuth } from './auth';
import { ValidationError, asObject, readString } from '../utils/validation';
import { recordAuditLog } from '../utils/audit';

const router = Router();
const MAX_JSON_CHARS = 600_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CodeProjectRow = {
  id: string;
  userId: string;
  name: string;
  filesJson: string;
  messagesJson: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function stringifyBounded(value: unknown, field: string): string {
  const json = JSON.stringify(value ?? {});
  if (json.length > MAX_JSON_CHARS) {
    throw new ValidationError(`${field} terlalu besar. Maksimal ${MAX_JSON_CHARS} karakter JSON.`);
  }
  return json;
}

export function safeParseProjectJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function publicProject(row: CodeProjectRow, includePayload = false) {
  const base: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (includePayload) {
    base.files = safeParseProjectJson(row.filesJson, {});
    base.messages = safeParseProjectJson(row.messagesJson, []);
  }
  return base;
}

router.get('/', requireAuth, async (req: any, res) => {
  const rows = await prisma.$queryRaw<CodeProjectRow[]>`
    SELECT id, userId, name, filesJson, messagesJson, createdAt, updatedAt
    FROM CodeProject
    WHERE userId = ${req.user.userId}
    ORDER BY updatedAt DESC
    LIMIT 50
  `;
  res.json(rows.map((row) => publicProject(row)));
});

router.get('/latest', requireAuth, async (req: any, res) => {
  const rows = await prisma.$queryRaw<CodeProjectRow[]>`
    SELECT id, userId, name, filesJson, messagesJson, createdAt, updatedAt
    FROM CodeProject
    WHERE userId = ${req.user.userId}
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  if (!rows[0]) return res.status(404).json({ error: 'Code project not found' });
  res.json(publicProject(rows[0], true));
});

router.get('/:id', requireAuth, async (req: any, res) => {
  const rows = await prisma.$queryRaw<CodeProjectRow[]>`
    SELECT id, userId, name, filesJson, messagesJson, createdAt, updatedAt
    FROM CodeProject
    WHERE id = ${req.params.id}
      AND userId = ${req.user.userId}
    LIMIT 1
  `;
  if (!rows[0]) return res.status(404).json({ error: 'Code project not found' });
  res.json(publicProject(rows[0], true));
});

router.post('/', requireAuth, async (req: any, res) => {
  try {
    const body = asObject(req.body);
    if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

    const providedId = readString(body, 'id', { max: 80 });
    if (providedId && !UUID_PATTERN.test(providedId)) {
      return res.status(400).json({ error: 'ID project tidak valid.' });
    }
    const id = providedId || crypto.randomUUID();
    const name = readString(body, 'name', { required: true, max: 120 });
    const filesJson = stringifyBounded(body.files, 'files');
    const messagesJson = stringifyBounded(Array.isArray(body.messages) ? body.messages : [], 'messages');
    const now = new Date();

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM CodeProject WHERE id = ${id} AND userId = ${req.user.userId} LIMIT 1
    `;

    if (existing[0]) {
      await prisma.$executeRaw`
        UPDATE CodeProject
        SET name = ${name}, filesJson = ${filesJson}, messagesJson = ${messagesJson}, updatedAt = ${now}
        WHERE id = ${id} AND userId = ${req.user.userId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO CodeProject (id, userId, name, filesJson, messagesJson, createdAt, updatedAt)
        VALUES (${id}, ${req.user.userId}, ${name}, ${filesJson}, ${messagesJson}, ${now}, ${now})
      `;
    }

    await recordAuditLog({
      userId: req.user.userId,
      action: existing[0] ? 'CODE_PROJECT_UPDATE' : 'CODE_PROJECT_CREATE',
      targetType: 'CodeProject',
      targetId: id,
      metadata: { name },
      req,
    });

    res.json({ id, name, updatedAt: now });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(error.statusCode).json({ error: error.message });
    console.error('Error saving code project:', error);
    res.status(500).json({ error: 'Failed to save code project' });
  }
});

router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    await prisma.$executeRaw`
      DELETE FROM CodeProject
      WHERE id = ${req.params.id}
        AND userId = ${req.user.userId}
    `;
    await recordAuditLog({
      userId: req.user.userId,
      action: 'CODE_PROJECT_DELETE',
      targetType: 'CodeProject',
      targetId: req.params.id,
      req,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting code project:', error);
    res.status(500).json({ error: 'Failed to delete code project' });
  }
});

export default router;
