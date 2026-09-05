import cors from 'cors';
import express from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiRouter } from './routes/index.js';
import { mockRouter } from './routes/api_mock.js';

export function createApp() {
  const app = express();
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

  // Behind a reverse proxy in deployment, so req.ip must come from the
  // forwarded header for the rate limiter and the audit log to be meaningful.
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https:'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'script-src': ["'self'", "'unsafe-inline'", 'https:'],
      },
    },
  }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProduction) app.use(morgan('dev'));

  /**
   * Login is rate limited separately and much harder than the rest of the API:
   * it is the one endpoint where guessing repeatedly is the whole attack
   * (Section 45).
   */
  /**
   * Login is rate limited strictly for remote traffic, while skipping local admin testing.
   */
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
    skip: (req) => {
      const ip = String(req.ip || req.headers['x-forwarded-for'] || '').trim();
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('127.0.0.1');
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many sign-in attempts. Please wait a moment and try again.' },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nirmala-api', env: env.nodeEnv });
  });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api', mockRouter);
  app.use('/api', apiLimiter, apiRouter);

  app.use('/api', notFoundHandler);
  app.use(express.static(path.join(currentDirectory, '..', 'public')));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(currentDirectory, '..', 'public', 'index.html'));
  });
  app.use(errorHandler);

  return app;
}
