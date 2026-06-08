import { PrismaClient } from '../generated/prisma';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function buildPrisma(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  // Gunakan Turso (cloud SQLite) jika dikonfigurasi, otherwise fallback ke file SQLite lokal
  if (tursoUrl && tursoToken) {
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: tursoToken,
    });
    return new PrismaClient({ adapter } as any);
  }

  // Fallback: SQLite file lokal (development)
  return new PrismaClient();
}

const prisma = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
