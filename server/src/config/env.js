import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to server/.env and fill it in.',
    );
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

// In development we fall back to a known-bad secret so the app starts on a
// fresh clone. In production a real secret is mandatory.
const jwtSecret = isProduction
  ? required('JWT_SECRET')
  : (process.env.JWT_SECRET ?? 'dev-only-insecure-secret');

if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  isDevelopment: !isProduction,
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/nirmala?replicaSet=rs0',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nirmalaenterprises.in',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
    name: process.env.SEED_ADMIN_NAME ?? 'System Administrator',
  },
  serverRoot,
};
