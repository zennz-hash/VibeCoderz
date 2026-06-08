-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "googleId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "prdQuota" INTEGER NOT NULL DEFAULT 1,
    "quotaUsedToday" INTEGER NOT NULL DEFAULT 0,
    "codeQuotaUsedToday" INTEGER NOT NULL DEFAULT 0,
    "lastQuotaReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Blueprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "shareExpiresAt" DATETIME,
    "shareViewCount" INTEGER NOT NULL DEFAULT 0,
    "folder" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Blueprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BlueprintVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blueprintId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlueprintVersion_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CodeProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filesJson" TEXT NOT NULL,
    "messagesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodeProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiRequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "PlanSubscription_userId_status_idx" ON "PlanSubscription"("userId", "status");
CREATE INDEX IF NOT EXISTS "PlanSubscription_activeUntil_idx" ON "PlanSubscription"("activeUntil");
CREATE UNIQUE INDEX IF NOT EXISTS "Blueprint_shareToken_key" ON "Blueprint"("shareToken");
CREATE INDEX IF NOT EXISTS "Blueprint_userId_createdAt_idx" ON "Blueprint"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Blueprint_shareToken_idx" ON "Blueprint"("shareToken");
CREATE INDEX IF NOT EXISTS "Blueprint_shareExpiresAt_idx" ON "Blueprint"("shareExpiresAt");
CREATE INDEX IF NOT EXISTS "Blueprint_userId_folder_idx" ON "Blueprint"("userId", "folder");
CREATE INDEX IF NOT EXISTS "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageLog_type_createdAt_idx" ON "UsageLog"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "BlueprintVersion_blueprintId_createdAt_idx" ON "BlueprintVersion"("blueprintId", "createdAt");
CREATE INDEX IF NOT EXISTS "BlueprintVersion_userId_createdAt_idx" ON "BlueprintVersion"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BlueprintVersion_blueprintId_version_key" ON "BlueprintVersion"("blueprintId", "version");
CREATE INDEX IF NOT EXISTS "CodeProject_userId_updatedAt_idx" ON "CodeProject"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AiRequestLog_userId_createdAt_idx" ON "AiRequestLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiRequestLog_type_createdAt_idx" ON "AiRequestLog"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "AiRequestLog_status_createdAt_idx" ON "AiRequestLog"("status", "createdAt");
