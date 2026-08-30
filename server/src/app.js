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
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.isProduction ? 10 : 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nirmala-api', env: env.nodeEnv });
  });

  if (env.isProduction) {
    app.use('/api/auth/login', loginLimiter);
  }
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
