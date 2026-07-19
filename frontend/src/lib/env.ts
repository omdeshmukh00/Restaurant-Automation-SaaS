import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_NAME: z.string().default('Restaurant Automation'),
  VITE_APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VITE_API_URL: z.string().url().default('http://localhost:5000/api/v1'),
  VITE_SOCKET_URL: z.string().url().default('http://localhost:5000'),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_ENABLE_NOTIFICATIONS: z.string().transform((value) => value === 'true').default('true'),
  VITE_ENABLE_ANALYTICS: z.string().transform((value) => value === 'true').default('false'),
  VITE_DEBUG_MODE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables');
}

/**
 * Dynamically resolves localhost URLs to match the current browser hostname
 * when accessing over local network IP (e.g. 10.x.x.x, 192.168.x.x).
 */
function resolveNetworkUrl(urlStr: string): string {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      try {
        const u = new URL(urlStr);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          u.hostname = hostname;
          return u.toString().replace(/\/$/, '');
        }
      } catch {
        return urlStr.replace(/localhost|127\.0\.0\.1/g, hostname);
      }
    }
  }
  return urlStr;
}

export const env = {
  appName: parsed.data.VITE_APP_NAME,
  mode: parsed.data.VITE_APP_ENV,
  get apiUrl() {
    return resolveNetworkUrl(parsed.data.VITE_API_URL);
  },
  get socketUrl() {
    return resolveNetworkUrl(parsed.data.VITE_SOCKET_URL);
  },
  sentryDsn: parsed.data.VITE_SENTRY_DSN ?? '',
  notificationsEnabled: parsed.data.VITE_ENABLE_NOTIFICATIONS,
  analyticsEnabled: parsed.data.VITE_ENABLE_ANALYTICS,
  debug: parsed.data.VITE_DEBUG_MODE ?? false,
};
