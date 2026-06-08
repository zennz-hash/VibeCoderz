import express from 'express';
const app = express();
app.use('/api/auth', (req, res) => res.send(`HIT: ${req.url} - ${req.originalUrl}`));
app.use((req, res) => res.status(404).send(`NOT FOUND: ${req.url} - ${req.originalUrl}`));
const req = { url: '/auth/google', method: 'GET' };
app.handle(req as any, {} as any, () => console.log('Done'));
