/**
 * rate-limit.ts — Simple rate limiting with graceful fallback
 *
 * When UPSTASH_REDIS_REST_URL is set: uses Upstash Redis sliding window
 * When not set: in-memory Map (single instance only, resets on restart)
 *
 * Production: always use Upstash Redis
 */

interface RateLimitResult {
  success: boolean;
  remaining?: number;
}

// In-memory fallback — Map<key, { count, resetAt }>
const memoryStore = new Map<string, { count: number; resetAt: number }>();

async function checkMemoryLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

async function checkRedisLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
  });

  const { success, remaining } = await ratelimit.limit(key);
  return { success, remaining };
}

export async function checkRateLimit(
  key: string,
  limit = 30,
  windowSec = 60
): Promise<RateLimitResult> {
  const hasRedis = !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  try {
    if (hasRedis) {
      return await checkRedisLimit(key, limit, windowSec);
    }
    return await checkMemoryLimit(key, limit, windowSec * 1000);
  } catch {
    // If rate limiting fails, allow the request (fail open)
    return { success: true };
  }
}
