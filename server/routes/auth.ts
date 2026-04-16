import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../src/utils/prisma';
import jwt from 'jsonwebtoken';

const router = Router();
const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return res.status(400).json({ error: 'Invalid Google access token' });
    }

    const payload = await response.json();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Failed to retrieve user email' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          googleId: payload.sub,
          role: 'USER',
        }
      });

      // Give new user a default starter plan
      await prisma.planSubscription.create({
        data: {
          userId: user.id,
          planType: 'STARTER',
          status: 'ACTIVE',
          prdQuota: 3,
        }
      });
    }

    // Load active subscription
    const subscription = await prisma.planSubscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' }
    });

    const authToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        plan: subscription?.planType || 'FREE',
        quota: subscription?.prdQuota || 0
      }
    });
    
  } catch (error: any) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

export default router;
