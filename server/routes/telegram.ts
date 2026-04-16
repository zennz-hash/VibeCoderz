import { Router } from 'express';
import prisma from '../../src/utils/prisma';
import { requireAuth } from './auth';
import { BotCrypto } from '../../src/utils/crypto';

const router = Router();

// Get Telegram Config
router.get('/config', requireAuth, async (req: any, res: any) => {
  try {
    const config = await prisma.telegramConfig.findUnique({
      where: { userId: req.user.userId },
      include: { targets: true }
    });

    if (!config) {
      return res.json({ status: 'NONE' });
    }

    res.json({
      status: config.status,
      // the token is decrypted and sent back? Usually partially obscured.
      // But for AutoPromo, we'll just send a flag if bounded.
      botConfigured: true,
      targets: config.targets
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch telegram config' });
  }
});

// Save Bot Config
router.post('/config', requireAuth, async (req: any, res: any) => {
  try {
    const { token } = req.body;
    
    // Simulate validation here (would normally fetch api.telegram.org/bot<token>/getMe)
    const encryptedToken = BotCrypto.encrypt(token);

    const config = await prisma.telegramConfig.upsert({
      where: { userId: req.user.userId },
      update: { botToken: encryptedToken, status: 'RUNNING' },
      create: { userId: req.user.userId, botToken: encryptedToken, status: 'RUNNING' },
    });

    res.json({ success: true, configId: config.id });
  } catch (error) {
    console.error('Error saving bot token:', error);
    res.status(500).json({ error: 'Failed to configure bot' });
  }
});

// Add Whitelist Target
router.post('/target', requireAuth, async (req: any, res: any) => {
  try {
    const { chatId, targetName } = req.body;

    const config = await prisma.telegramConfig.findUnique({
      where: { userId: req.user.userId }
    });

    if (!config) return res.status(404).json({ error: 'Bot config not found' });

    const target = await prisma.telegramTarget.create({
      data: {
        configId: config.id,
        chatId: chatId,
        targetName: targetName
      }
    });

    res.json({ success: true, target });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add target' });
  }
});

export default router;
