import crypto from 'node:crypto';
import prisma from '../../src/utils/prisma';

export type BlueprintVersionRow = {
  id: string;
  blueprintId: string;
  userId: string;
  version: number | bigint;
  name: string;
  content: string;
  source: string;
  createdAt: Date | string;
};

type BlueprintWithoutVersionRow = {
  id: string;
  userId: string;
  name: string;
  content: string;
  createdAt: Date | string;
};

export async function createBlueprintVersion(params: {
  blueprintId: string;
  userId: string;
  name: string;
  content: string;
  source: 'GENERATE' | 'MANUAL_EDIT' | 'AI_REVISE' | 'RESTORE' | 'DUPLICATE';
}): Promise<number> {
  const id = crypto.randomUUID();

  // Atomic: INSERT with MAX(version)+1 dalam satu statement → tidak ada race condition
  await prisma.$executeRaw`
    INSERT INTO BlueprintVersion (id, blueprintId, userId, version, name, content, source, createdAt)
    SELECT
      ${id},
      ${params.blueprintId},
      ${params.userId},
      COALESCE(MAX(version), 0) + 1,
      ${params.name},
      ${params.content},
      ${params.source},
      ${new Date()}
    FROM BlueprintVersion
    WHERE blueprintId = ${params.blueprintId}
  `;

  // Baca nextVersion yang baru diinsert
  const rows = await prisma.$queryRaw<Array<{ version: number | bigint }>>`
    SELECT version FROM BlueprintVersion WHERE id = ${id} LIMIT 1
  `;
  const nextVersion = Number(rows[0]?.version || 1);

  await prisma.$executeRaw`
    UPDATE Blueprint
    SET currentVersion = ${nextVersion}, updatedAt = ${new Date()}
    WHERE id = ${params.blueprintId}
  `.catch(() => {});

  return nextVersion;
}

export async function backfillMissingBlueprintVersions(): Promise<number> {
  const rows = await prisma.$queryRaw<BlueprintWithoutVersionRow[]>`
    SELECT b.id, b.userId, b.name, b.content, b.createdAt
    FROM Blueprint b
    LEFT JOIN BlueprintVersion v ON v.blueprintId = b.id
    WHERE v.id IS NULL
  `;

  for (const row of rows) {
    await prisma.$executeRaw`
      INSERT INTO BlueprintVersion (id, blueprintId, userId, version, name, content, source, createdAt)
      SELECT ${crypto.randomUUID()}, ${row.id}, ${row.userId}, 1, ${row.name}, ${row.content}, 'BACKFILL', ${row.createdAt}
      WHERE NOT EXISTS (
        SELECT 1 FROM BlueprintVersion WHERE blueprintId = ${row.id}
      )
    `;

    await prisma.$executeRaw`
      UPDATE Blueprint
      SET currentVersion = 1
      WHERE id = ${row.id}
        AND currentVersion < 1
    `.catch(() => {});
  }

  return rows.length;
}

export async function listBlueprintVersions(blueprintId: string, userId: string): Promise<BlueprintVersionRow[]> {
  return prisma.$queryRaw<BlueprintVersionRow[]>`
    SELECT v.id, v.blueprintId, v.userId, v.version, v.name, v.content, v.source, v.createdAt
    FROM BlueprintVersion v
    JOIN Blueprint b ON b.id = v.blueprintId
    WHERE v.blueprintId = ${blueprintId}
      AND b.userId = ${userId}
    ORDER BY v.version DESC
  `;
}

export async function getBlueprintVersion(versionId: string, userId: string): Promise<BlueprintVersionRow | null> {
  const rows = await prisma.$queryRaw<BlueprintVersionRow[]>`
    SELECT v.id, v.blueprintId, v.userId, v.version, v.name, v.content, v.source, v.createdAt
    FROM BlueprintVersion v
    JOIN Blueprint b ON b.id = v.blueprintId
    WHERE v.id = ${versionId}
      AND b.userId = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}
