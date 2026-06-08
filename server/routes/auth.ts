import { Router } from 'express';
import prisma from '../../src/utils/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { recordAuditLog } from '../utils/audit';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set in environment.');
}
const jwtSecret = JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FATAL: JWT_SECRET must be set in .env with at least 32 characters.');
  process.exit(1);
}

const SESSION_COOKIE = 'vc_session';
const CSRF_COOKIE = 'vc_csrf';
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_EMAILS: string[] = [];

type AuthSessionRow = {
  id: string;
  userId: string;
  expiresAt: Date | string;
};

type GoogleIdTokenPayload = {
  sub: string;
  aud: string;
  iss?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

class LoginError extends Error {
  constructor(message: string, public statusCode = 401) {
    super(message);
  }
}

function configuredAdminEmails() {
  const configured = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set((configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS).map((email) => email.toLowerCase()));
}

function isBootstrapAdminEmail(email?: string | null) {
  return Boolean(email && configuredAdminEmails().has(email.toLowerCase()));
}

function readGoogleCredential(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const source = body as Record<string, unknown>;
  const value = source.credential ?? source.id_token ?? source.idToken ?? source.token;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cookieOptions() {
  const sameSite = process.env.AUTH_COOKIE_SAMESITE === 'none' || process.env.CROSS_SITE_COOKIES === 'true'
    ? 'none'
    : 'lax';
  return {
    httpOnly: true,
    sameSite: sameSite as 'lax' | 'none',
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

function csrfCookieOptions() {
  const sameSite = process.env.AUTH_COOKIE_SAMESITE === 'none' || process.env.CROSS_SITE_COOKIES === 'true'
    ? 'none'
    : 'lax';
  return {
    httpOnly: false,
    sameSite: sameSite as 'lax' | 'none',
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rawValue] = item.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});
}

async function verifyGoogleIdToken(credential: string): Promise<GoogleIdTokenPayload> {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'dummy_client_id') {
    throw new LoginError('Login Google belum dikonfigurasi di server.', 500);
  }

  let tokenInfoRes: Response;
  try {
    tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  } catch {
    throw new LoginError('Gagal memverifikasi token Google. Coba lagi sebentar.', 502);
  }
  if (!tokenInfoRes.ok) {
    throw new LoginError('Token Google tidak valid atau sudah kedaluwarsa.');
  }

  const payload = await tokenInfoRes.json() as GoogleIdTokenPayload;
  const trustedIssuer = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
  if (!trustedIssuer) throw new LoginError('Issuer token Google tidak valid.');
  if (payload.aud !== clientId) throw new LoginError('Token Google bukan untuk aplikasi ini.');
  if (!payload.sub || !payload.email) throw new LoginError('Token Google tidak berisi identitas yang lengkap.');
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new LoginError('Email Google belum terverifikasi.');
  }

  return payload;
}

async function ensureFreeSubscription(userId: string) {
  await prisma.planSubscription.updateMany({
    where: {
      userId,
      status: 'ACTIVE',
      activeUntil: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  const existing = await prisma.planSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.planSubscription.create({
    data: {
      userId,
      planType: 'FREE',
      status: 'ACTIVE',
      prdQuota: 1,
    },
  });
}

async function deleteExpiredSessions(userId: string) {
  await prisma.$executeRaw`
    DELETE FROM AuthSession
    WHERE userId = ${userId}
      AND expiresAt <= ${new Date()}
  `;
}

async function createAuthSession(userId: string, expiresAt: Date): Promise<AuthSessionRow> {
  const id = crypto.randomUUID();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO AuthSession (id, userId, expiresAt, createdAt, updatedAt)
    VALUES (${id}, ${userId}, ${expiresAt}, ${now}, ${now})
  `;
  return { id, userId, expiresAt };
}

async function revokeAuthSession(sessionId: string) {
  await prisma.$executeRaw`
    UPDATE AuthSession
    SET revokedAt = ${new Date()}, updatedAt = ${new Date()}
    WHERE id = ${sessionId}
      AND revokedAt IS NULL
  `;
}

async function findActiveAuthSession(sessionId: string, userId: string): Promise<AuthSessionRow | null> {
  const rows = await prisma.$queryRaw<AuthSessionRow[]>`
    SELECT id, userId, expiresAt
    FROM AuthSession
    WHERE id = ${sessionId}
      AND userId = ${userId}
      AND revokedAt IS NULL
      AND expiresAt > ${new Date()}
    LIMIT 1
  `;
  return rows[0] || null;
}

router.post('/google', async (req, res) => {
  try {
    const credential = readGoogleCredential(req.body);
    if (!credential) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    const payload = await verifyGoogleIdToken(credential);
    const shouldBeAdmin = isBootstrapAdminEmail(payload.email);

    const user = await prisma.user.upsert({
      where: { email: payload.email! },
      update: {
        name: payload.name,
        picture: payload.picture,
        googleId: payload.sub,
        ...(shouldBeAdmin ? { role: 'ADMIN' } : {}),
      },
      create: {
        email: payload.email!,
        name: payload.name,
        picture: payload.picture,
        googleId: payload.sub,
        role: shouldBeAdmin ? 'ADMIN' : 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
      },
    });

    const subscription = await ensureFreeSubscription(user.id);
    await deleteExpiredSessions(user.id);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await createAuthSession(user.id, expiresAt);
    const csrfToken = crypto.randomBytes(32).toString('hex');

    const authToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, sessionId: session.id, csrfToken },
      jwtSecret,
      { expiresIn: `${SESSION_TTL_DAYS}d` }
    );

    res.cookie(SESSION_COOKIE, authToken, cookieOptions());
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    await recordAuditLog({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'User',
      targetId: user.id,
      req,
    });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        csrfToken,
        plan: subscription.planType,
        quota: subscription.prdQuota,
      },
    });
  } catch (error: any) {
    console.error('Login Error:', error?.message || error);
    const isExpectedLoginError = error instanceof LoginError;
    await recordAuditLog({
      action: 'AUTH_LOGIN_FAILED',
      metadata: { error: error?.message || 'Authentication failed' },
      req,
    });
    res.status(isExpectedLoginError ? error.statusCode : 500).json({
      error: isExpectedLoginError ? error.message : 'Login gagal karena kesalahan server. Coba lagi sebentar.',
    });
  }
});

router.post('/logout', async (req: any, res) => {
  try {
    const token = getAuthToken(req);
    if (token) {
      const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
      if (typeof decoded.sessionId === 'string') {
        await revokeAuthSession(decoded.sessionId);
      }
    }
  } catch {
    // Logout should be idempotent even if token is expired or malformed.
  }

  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
  res.json({ success: true });
});

function getAuthToken(req: any): string | null {
  const bearer = req.headers.authorization?.split(' ')[1];
  if (bearer) return bearer;

  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] || null;
}

export const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (typeof decoded.userId !== 'string' || typeof decoded.sessionId !== 'string') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const session = await findActiveAuthSession(decoded.sessionId, decoded.userId);
    if (!session) return res.status(403).json({ error: 'Forbidden' });

    const freshUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    });
    if (!freshUser) return res.status(403).json({ error: 'Forbidden' });

    const method = String(req.method || 'GET').toUpperCase();
    const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (needsCsrf) {
      const headerToken = req.headers['x-csrf-token'];
      const csrfHeader = Array.isArray(headerToken) ? headerToken[0] : headerToken;
      if (typeof decoded.csrfToken !== 'string' || csrfHeader !== decoded.csrfToken) {
        return res.status(403).json({ error: 'CSRF token invalid. Silakan refresh halaman dan coba lagi.' });
      }
    }

    req.user = {
      userId: decoded.userId,
      email: freshUser.email,
      role: freshUser.role,
      sessionId: decoded.sessionId,
      csrfToken: decoded.csrfToken,
    };
    next();
  } catch {
    return res.status(403).json({ error: 'Forbidden' });
  }
};

export const requireAdmin = async (req: any, res: any, next: any) => {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

export default router;
