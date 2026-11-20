import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './routes.js';
import { AiUnavailableError } from './errors.js';
import { HELPLINES } from './catalog.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

/**
 * Builds the Express app. Dependencies are injected so tests can supply a fake AI engine.
 *
 * @param {{ assistant: object, rateLimitPerMinute?: number, logger?: Pick<Console, 'error'> }} deps
 */
export function createApp({ assistant, rateLimitPerMinute = 30, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Cloud Run sits behind one Google front end proxy.

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use((_req, res, next) => {
    res.set('Permissions-Policy', 'microphone=(self), camera=(self), geolocation=()');
    next();
  });
  app.use(compression());

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: rateLimitPerMinute, standardHeaders: 'draft-7', legacyHeaders: false }),
    express.json({ limit: '7mb' }),
    (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    createApiRouter({ assistant }),
  );

  app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // Error handler: never leak stack traces or request bodies (they may contain health data).
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AiUnavailableError) {
      logger.error(`[ai] ${err.reason}`);
      res.status(503).json({
        error: 'ai_unavailable',
        message: 'The AI assistant is unavailable right now. If you are in danger, call a helpline below.',
        helplines: HELPLINES.IN,
      });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'payload_too_large' });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
    logger.error(`[server] ${err?.name ?? 'Error'}: ${err?.message ?? 'unknown'}`);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
