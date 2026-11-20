import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_DEV_JWT_SECRET = 'dev-secret';

export function assertProductionSecrets(nodeEnv = process.env.NODE_ENV, rawJwtSecret = process.env.JWT_SECRET): void {
  if (nodeEnv !== 'production') return;
  const secret = (rawJwtSecret || '').trim();
  if (!secret || secret === DEFAULT_DEV_JWT_SECRET || secret.length < 16) {
    throw new Error(
      '[Core-API] Refusing to start in production without a strong JWT_SECRET (>= 16 characters, not dev-secret).',
    );
  }
}

assertProductionSecrets();

function parseTrustProxy(raw?: string): boolean | number | string {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v || v === '0' || v === 'false') return false;
  if (v === 'true') return true;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : v;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cdnServiceUrl: process.env.CDN_SERVICE_URL || 'http://localhost:4001',
  paymentProvider: (process.env.PAYMENT_PROVIDER || 'mock') as 'mock' | 'stripe',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  platformFeeBps: Number(process.env.PLATFORM_FEE_BPS) || 700, // 700 bps = 7% platform fee
};

