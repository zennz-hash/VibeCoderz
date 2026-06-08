import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma';
import { PrismaLibSql } from '@prisma/adapter-libsql';

process.env.SQLITE_URL = ''; // simulate missing
process.env.TURSO_DATABASE_URL = 'libsql://dummy.turso.io';
process.env.TURSO_AUTH_TOKEN = 'dummy';

try {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const prisma = new PrismaClient({ adapter } as any);
  console.log("Prisma client created successfully");
} catch (err: any) {
  console.error("ERROR:", err.message);
}
