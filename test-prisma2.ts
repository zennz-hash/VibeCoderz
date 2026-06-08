import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
const client = createClient({ url: "file:test.db" });
const adapter = new PrismaLibSql(client);
