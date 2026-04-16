import { Router } from 'express';
import prisma from '../../src/utils/prisma';
import { requireAuth } from './auth';

const router = Router();

// Get all blueprints for the logged in user
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const blueprints = await prisma.blueprint.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(blueprints);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blueprints' });
  }
});

// Save a new blueprint
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { name, type, content } = req.body;
    
    if (!name || !type || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const blueprint = await prisma.blueprint.create({
      data: {
        userId: req.user.userId,
        name,
        type,
        content
      }
    });

    res.json(blueprint);
  } catch (error) {
    console.error('Error saving blueprint:', error);
    res.status(500).json({ error: 'Failed to save blueprint' });
  }
});

export default router;
