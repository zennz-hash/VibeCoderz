import { Router } from 'express';
import prisma from '../../src/utils/prisma';
import { requireAuth } from './auth';
import { ValidationError, asObject, readString } from '../utils/validation';
import { recordAuditLog } from '../utils/audit';
import { createBlueprintVersion, getBlueprintVersion, listBlueprintVersions } from '../utils/blueprintVersions';

const router = Router();

type BlueprintRow = {
  id: string;
  userId: string;
  name: string;
  type: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isPublic: boolean | number;
  shareToken: string | null;
  shareExpiresAt: Date | string | null;
  shareViewCount: number;
  folder: string | null;
  tagsJson: string;
  currentVersion: number;
};

function safeDownloadName(name: string, ext: string): string {
  return `${name.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'blueprint'}.${ext}`;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];

  const rawTags = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;

  if (!rawTags) throw new ValidationError('tags harus berupa array atau teks dipisah koma.');

  const tags = rawTags
    .map((tag) => {
      if (typeof tag !== 'string') throw new ValidationError('tags hanya boleh berisi teks.');
      return tag.trim().replace(/^#+/, '');
    })
    .filter(Boolean)
    .map((tag) => tag.slice(0, 24));

  return Array.from(new Set(tags)).slice(0, 8);
}

function readMetadata(body: Record<string, unknown>) {
  const folder = body.folder === undefined
    ? undefined
    : readString(body, 'folder', { max: 60 }) || null;
  const tags = body.tags === undefined && body.tagsJson === undefined
    ? undefined
    : parseTags(body.tags ?? body.tagsJson);

  return { folder, tags };
}

function attachParsedTags<T extends { tagsJson?: string | null }>(row: T): T & { tags: string[] } {
  try {
    const parsed = row.tagsJson ? JSON.parse(row.tagsJson) : [];
    return { ...row, tags: Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === 'string') : [] };
  } catch {
    return { ...row, tags: [] };
  }
}

export async function getBlueprintRow(id: string, userId: string): Promise<(BlueprintRow & { tags: string[] }) | null> {
  const rows = await prisma.$queryRaw<BlueprintRow[]>`
    SELECT id, userId, name, type, content, createdAt, updatedAt, isPublic, shareToken, shareExpiresAt, shareViewCount, folder, tagsJson, currentVersion
    FROM Blueprint
    WHERE id = ${id}
      AND userId = ${userId}
    LIMIT 1
  `;
  return rows[0] ? attachParsedTags(rows[0]) : null;
}

// Get all blueprints for the logged in user
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const blueprints = await prisma.$queryRaw<BlueprintRow[]>`
      SELECT id, userId, name, type, createdAt, updatedAt, isPublic, shareToken, shareExpiresAt, shareViewCount, folder, tagsJson, currentVersion
      FROM Blueprint
      WHERE userId = ${req.user.userId}
      ORDER BY createdAt DESC
      LIMIT 200
    `;
    res.json(blueprints.map(attachParsedTags));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blueprints' });
  }
});

// Save a new blueprint
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const body = asObject(req.body);
    if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

    const name = readString(body, 'name', { required: true, max: 120 });
    const type = readString(body, 'type', { required: true, max: 80 });
    const content = readString(body, 'content', { required: true, max: 50000 });
    const { folder, tags } = readMetadata(body);

    const blueprint = await prisma.blueprint.create({
      data: {
        userId: req.user.userId,
        name,
        type,
        content
      }
    });

    if (folder !== undefined || tags !== undefined) {
      await prisma.$executeRaw`
        UPDATE Blueprint
        SET folder = ${folder ?? null}, tagsJson = ${JSON.stringify(tags ?? [])}, updatedAt = ${new Date()}
        WHERE id = ${blueprint.id}
      `;
    }

    await createBlueprintVersion({
      blueprintId: blueprint.id,
      userId: req.user.userId,
      name: blueprint.name,
      content: blueprint.content,
      source: 'GENERATE',
    }).catch(() => {});
    await recordAuditLog({
      userId: req.user.userId,
      action: 'BLUEPRINT_CREATE',
      targetType: 'Blueprint',
      targetId: blueprint.id,
      metadata: { name, type, folder: folder ?? null, tags: tags ?? [] },
      req,
    });

    res.json(await getBlueprintRow(blueprint.id, req.user.userId));
  } catch (error) {
    console.error('Error saving blueprint:', error);
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to save blueprint' });
  }
});

router.post('/:id/duplicate', requireAuth, async (req: any, res: any) => {
  try {
    const blueprint = await getBlueprintRow(req.params.id, req.user.userId);
    if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });

    const duplicate = await prisma.blueprint.create({
      data: {
        userId: req.user.userId,
        name: `${blueprint.name} Copy`,
        type: blueprint.type,
        content: blueprint.content,
      }
    });

    await prisma.$executeRaw`
      UPDATE Blueprint
      SET folder = ${blueprint.folder}, tagsJson = ${blueprint.tagsJson || '[]'}, updatedAt = ${new Date()}
      WHERE id = ${duplicate.id}
    `;

    await createBlueprintVersion({
      blueprintId: duplicate.id,
      userId: req.user.userId,
      name: duplicate.name,
      content: duplicate.content,
      source: 'DUPLICATE',
    }).catch(() => {});
    await recordAuditLog({
      userId: req.user.userId,
      action: 'BLUEPRINT_DUPLICATE',
      targetType: 'Blueprint',
      targetId: duplicate.id,
      metadata: { sourceId: blueprint.id },
      req,
    });

    res.json(await getBlueprintRow(duplicate.id, req.user.userId));
  } catch (error) {
    console.error('Error duplicating blueprint:', error);
    res.status(500).json({ error: 'Failed to duplicate blueprint' });
  }
});

router.get('/:id/versions', requireAuth, async (req: any, res: any) => {
  try {
    const versions = await listBlueprintVersions(req.params.id, req.user.userId);
    res.json(versions.map((version) => ({
      ...version,
      version: Number(version.version),
      contentPreview: version.content.slice(0, 240),
      content: undefined,
    })));
  } catch (error) {
    console.error('Error fetching blueprint versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

router.post('/:id/versions/:versionId/restore', requireAuth, async (req: any, res: any) => {
  try {
    const blueprint = await prisma.blueprint.findFirst({
      where: { id: req.params.id, userId: req.user.userId }
    });
    if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });

    const version = await getBlueprintVersion(req.params.versionId, req.user.userId);
    if (!version || version.blueprintId !== blueprint.id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const updated = await prisma.blueprint.update({
      where: { id: blueprint.id },
      data: {
        name: version.name,
        content: version.content,
      }
    });

    await createBlueprintVersion({
      blueprintId: updated.id,
      userId: req.user.userId,
      name: updated.name,
      content: updated.content,
      source: 'RESTORE',
    }).catch(() => {});
    await recordAuditLog({
      userId: req.user.userId,
      action: 'BLUEPRINT_VERSION_RESTORE',
      targetType: 'Blueprint',
      targetId: updated.id,
      metadata: { versionId: req.params.versionId },
      req,
    });

    const fresh = await getBlueprintRow(updated.id, req.user.userId);
    res.json(fresh || updated);
  } catch (error) {
    console.error('Error restoring blueprint version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

router.get('/:id/export', requireAuth, async (req: any, res: any) => {
  try {
    const blueprint = await getBlueprintRow(req.params.id, req.user.userId);
    if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });

    const format = String(req.query.format || 'md').toLowerCase();
    await recordAuditLog({
      userId: req.user.userId,
      action: 'BLUEPRINT_EXPORT',
      targetType: 'Blueprint',
      targetId: blueprint.id,
      metadata: { format },
      req,
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(blueprint.name, 'json')}"`);
      return res.send(JSON.stringify({
        id: blueprint.id,
        name: blueprint.name,
        type: blueprint.type,
        folder: blueprint.folder,
        tags: blueprint.tags,
        content: blueprint.content,
        createdAt: blueprint.createdAt,
        updatedAt: blueprint.updatedAt,
      }, null, 2));
    }

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(blueprint.name, 'html')}"`);
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(blueprint.name)}</title><style>body{font-family:system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 24px;line-height:1.6;color:#111}pre{white-space:pre-wrap}</style></head><body><h1>${htmlEscape(blueprint.name)}</h1><p><strong>${htmlEscape(blueprint.type)}</strong></p><pre>${htmlEscape(blueprint.content)}</pre></body></html>`);
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(blueprint.name, 'md')}"`);
    res.send(blueprint.content);
  } catch (error) {
    console.error('Error exporting blueprint:', error);
    res.status(500).json({ error: 'Failed to export blueprint' });
  }
});

// Get a single blueprint by ID
router.get('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const blueprint = await getBlueprintRow(req.params.id, req.user.userId);

    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    res.json(blueprint);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blueprint' });
  }
});

// Delete a blueprint
router.delete('/:id', requireAuth, async (req: any, res: any) => {
  try {
    // Verify ownership before deleting
    const blueprint = await prisma.blueprint.findFirst({
      where: { id: req.params.id, userId: req.user.userId }
    });

    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    await prisma.blueprint.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      userId: req.user.userId,
      action: 'BLUEPRINT_DELETE',
      targetType: 'Blueprint',
      targetId: req.params.id,
      metadata: { name: blueprint.name },
      req,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting blueprint:', error);
    res.status(500).json({ error: 'Failed to delete blueprint' });
  }
});

// Update blueprint content (direct edit — PRO/PRO_MAX only)
router.put('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const blueprint = await prisma.blueprint.findFirst({
      where: { id: req.params.id, userId: req.user.userId }
    });

    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    const body = asObject(req.body);
    if (!body) return res.status(400).json({ error: 'Payload tidak valid.' });

    const content = body.content === undefined ? undefined : readString(body, 'content', { max: 50000 });
    const name = body.name === undefined ? undefined : readString(body, 'name', { max: 120 });
    const { folder, tags } = readMetadata(body);

    if (content !== undefined || name !== undefined) {
      const { getActiveSubscription } = await import('./quota');
      const sub = await getActiveSubscription(req.user.userId);
      if (!sub || (sub.planType !== 'PRO' && sub.planType !== 'PRO_MAX')) {
        return res.status(403).json({ error: 'Edit PRD hanya tersedia untuk paket Pro dan Pro Max.' });
      }
    }

    const updated = await prisma.blueprint.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: {
        ...(content !== undefined && { content }),
        ...(name !== undefined && { name }),
      }
    });

    if (folder !== undefined) {
      await prisma.$executeRaw`
        UPDATE Blueprint
        SET folder = ${folder}, updatedAt = ${new Date()}
        WHERE id = ${req.params.id}
      `;
    }
    if (tags !== undefined) {
      await prisma.$executeRaw`
        UPDATE Blueprint
        SET tagsJson = ${JSON.stringify(tags)}, updatedAt = ${new Date()}
        WHERE id = ${req.params.id}
      `;
    }

    const fresh = await getBlueprintRow(req.params.id, req.user.userId);
    if (!fresh) return res.status(404).json({ error: 'Blueprint not found' });

    if (content !== undefined || name !== undefined) {
      await createBlueprintVersion({
        blueprintId: fresh.id,
        userId: req.user.userId,
        name: fresh.name,
        content: fresh.content,
        source: 'MANUAL_EDIT',
      }).catch(() => {});
    }
    await recordAuditLog({
      userId: req.user.userId,
      action: 'BLUEPRINT_UPDATE',
      targetType: 'Blueprint',
      targetId: fresh.id,
      metadata: { name: fresh.name, folder: fresh.folder, tags: fresh.tags },
      req,
    });

    res.json(fresh);
  } catch (error) {
    console.error('Error updating blueprint:', error);
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update blueprint' });
  }
});

export default router;
