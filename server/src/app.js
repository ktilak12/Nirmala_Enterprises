import cors from 'cors';
import express from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
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
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'script-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }));
  app.use(cors({
    origin: [
      env.clientOrigin,
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProduction) app.use(morgan('dev'));

  /**
   * Login is rate limited separately and strictly enforced to prevent brute-force attacks.
   */
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
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

  // Universal API rate limiter applies to ALL /api requests
  app.use('/api', apiLimiter);
  app.use('/api/auth/login', loginLimiter);

  // Dynamic Routing Strategy:
  // 1. If MongoDB is connected, prioritize apiRouter (ACID multi-document transactions & Zod schemas).
  // 2. In development (!env.isProduction), fall through to mockRouter if an endpoint is not handled by apiRouter or when DB is offline.
  // 3. In production, never fallback to unvalidated mock storage.
  app.use('/api', (req, res, next) => {
    const isDbConnected = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
    if (isDbConnected) {
      return apiRouter(req, res, (err) => {
        if (err) return next(err);
        if (!env.isProduction) {
          return mockRouter(req, res, next);
        }
        return next();
      });
    }

    if (!env.isProduction) {
      return mockRouter(req, res, next);
    }

    return res.status(503).json({
      success: false,
      message: 'Database service temporarily unavailable in production mode.',
    });
  });

  app.use('/api', notFoundHandler);
  app.use(express.static(path.join(currentDirectory, '..', 'public')));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(currentDirectory, '..', 'public', 'index.html'));
  });
  app.use(errorHandler);

  return app;
}
