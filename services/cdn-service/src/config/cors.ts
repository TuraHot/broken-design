// Allowed browser origins for private/mutating CDN-service routes (/api/*, /verify-watermark, /health).
// /cdn/* streams stay open (`origin: "*"`) so third-party embeds (<vm-model>, iframe) work on any domain.
import { env } from './env';

/** Resolve allowed frontend origins (supports comma-separated list; adds loopback twin outside production). */
export function allowedOrigins(
  frontendUrl = env.frontendUrl,
  nodeEnv = process.env.NODE_ENV,
): string[] {
  const configured = frontendUrl
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const seeds = configured.length > 0 ? configured : ['http://localhost:3000'];
  const origins = new Set<string>(seeds);

  if (nodeEnv === 'production') {
    return Array.from(origins);
  }

  for (const raw of seeds) {
    try {
      const url = new URL(raw);
      const twin =
        url.hostname === 'localhost'
          ? '127.0.0.1'
          : url.hostname === '127.0.0.1'
            ? 'localhost'
            : null;
      if (twin) {
        url.hostname = twin;
        origins.add(url.origin);
      }
    } catch {
      // Malformed origin strings remain as-is.
    }
  }

  return Array.from(origins);
}
