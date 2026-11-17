import { Router } from 'express';

// GET /settings, GET /health (mounted at /api).
export default function settingsRoutes(ctx) {
  const router = Router();

  router.get('/settings', (req, res) => {
    res.json(ctx.settings.public());
  });

  router.get('/health', (req, res) => {
    ctx.db.get('SELECT 1 AS alive');
    res.json({ ok: true, time: ctx.now() });
  });

  return router;
}
