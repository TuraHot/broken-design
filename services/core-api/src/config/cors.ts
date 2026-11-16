// Which browser origins may call core-api.
// Always the configured FRONTEND_URL. Outside production, its loopback twin too: `localhost` and
// `127.0.0.1` are different origins to a browser, and the dev site is reachable on both.
import { env } from './env';

export function allowedOrigins(frontendUrl = env.frontendUrl, nodeEnv = process.env.NODE_ENV): string[] {
  const origins = [frontendUrl];
  if (nodeEnv === 'production') return origins;

  try {
    const url = new URL(frontendUrl);
    const twin = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname === '127.0.0.1' ? 'localhost' : null;
    if (twin) {
      url.hostname = twin;
      origins.push(url.origin);
    }
  } catch {
    // FRONTEND_URL is not a valid URL: keep only the configured value.
  }
  return origins;
}
