import crypto from 'crypto';

const algorithm = 'aes-256-cbc';

if (!process.env.ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY is not set in .env! A random key will be generated. Encrypted data will be LOST on server restart. Set a persistent 64-character hex string as ENCRYPTION_KEY in .env.');
}

const secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

export const BotCrypto = {
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  },

  decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
};
