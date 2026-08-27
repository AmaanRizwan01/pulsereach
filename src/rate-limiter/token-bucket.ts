/**
 * Pulsereach — Multi-Service Token-Bucket Rate Limiter
 * Protects external API quotas (Gemini, Gmail, Sheets, Telegram) and enforces strict delay intervals.
 */

export type ServiceName = 'gemini' | 'gmail' | 'sheets' | 'telegram';

export interface RateLimiterConfig {
  /** Maximum burst capacity */
  maxTokens: number;
  /** Tokens refilled per second */
  refillRate: number;
  /** Minimum delay required between consecutive requests in ms */
  minDelayMs: number;
  /** Daily request quota budget */
  dailyBudget: number;
}

export const SERVICE_LIMITS: Record<ServiceName, RateLimiterConfig> = {
  gemini: { maxTokens: 8, refillRate: 0.25, minDelayMs: 2000, dailyBudget: 1500 },
  gmail: { maxTokens: 5, refillRate: 1.0, minDelayMs: 1000, dailyBudget: 250 },
  sheets: { maxTokens: 5, refillRate: 1.0, minDelayMs: 1000, dailyBudget: 1000 },
  telegram: { maxTokens: 1, refillRate: 0.67, minDelayMs: 1500, dailyBudget: 5000 },
};

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private lastRequestTime: number;
  private dailyCount: number;
  private lastDailyReset: string;
  private readonly config: RateLimiterConfig;
  private readonly service: ServiceName;

  constructor(service: ServiceName, config: RateLimiterConfig) {
    this.service = service;
    this.config = config;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
    this.lastRequestTime = 0;
    this.dailyCount = 0;
    this.lastDailyReset = new Date().toISOString().split('T')[0];
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastDailyReset) {
      this.dailyCount = 0;
      this.lastDailyReset = today;
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.config.maxTokens, this.tokens + elapsedSeconds * this.config.refillRate);
    this.lastRefill = now;
  }

  public async acquire(cost: number = 1): Promise<void> {
    this.checkDailyReset();

    while (true) {
      this.refill();
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      const minDelayRemaining = Math.max(0, this.config.minDelayMs - timeSinceLast);

      if (this.tokens >= cost && minDelayRemaining === 0) {
        this.tokens -= cost;
        this.lastRequestTime = Date.now();
        this.dailyCount += 1;

        if (this.dailyCount >= this.config.dailyBudget * 0.8) {
          console.warn(
            `⚠️ [RateLimiter] Service '${this.service}' reached ${this.dailyCount}/${this.config.dailyBudget} (>=80%) of daily budget!`
          );
        }
        return;
      }

      // Calculate time needed to get enough tokens or satisfy minDelay
      const tokenDeficit = Math.max(0, cost - this.tokens);
      const waitForTokensMs = (tokenDeficit / this.config.refillRate) * 1000;
      const waitMs = Math.max(minDelayRemaining, waitForTokensMs, 50);

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  public getState() {
    this.refill();
    return {
      service: this.service,
      tokens: Number(this.tokens.toFixed(2)),
      dailyCount: this.dailyCount,
      dailyBudget: this.config.dailyBudget,
      lastRequestTime: this.lastRequestTime,
    };
  }

  public reset(): void {
    this.tokens = this.config.maxTokens;
    this.lastRefill = Date.now();
    this.lastRequestTime = 0;
    this.dailyCount = 0;
  }
}

const buckets: Map<ServiceName, TokenBucket> = new Map();

function getBucket(service: ServiceName): TokenBucket {
  if (!buckets.has(service)) {
    const config = SERVICE_LIMITS[service];
    buckets.set(service, new TokenBucket(service, config));
  }
  return buckets.get(service)!;
}

/**
 * Throttles execution until a rate limit token is available for the given service.
 *
 * @param service - Target external service ('gemini' | 'gmail' | 'sheets' | 'telegram')
 * @param cost - Token cost (default 1)
 */
export async function throttle(service: ServiceName, cost: number = 1): Promise<void> {
  const bucket = getBucket(service);
  await bucket.acquire(cost);
}

/**
 * Returns current token and daily counter state for a service.
 */
export function getLimiterState(service: ServiceName) {
  return getBucket(service).getState();
}

/**
 * Resets a service's rate limiter bucket (useful for testing).
 */
export function resetLimiter(service: ServiceName): void {
  getBucket(service).reset();
}
