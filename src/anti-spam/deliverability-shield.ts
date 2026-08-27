/**
 * Pulsereach — Anti-Spam & Email Deliverability Shield
 * Protects candidate email deliverability with a 4-week warm-up ladder, 15-minute throttle, UAE business-hours gate, and bounce-rate circuit breaker.
 */

export interface WarmUpTier {
  maxSendsPerDay: number;
  maxPerTrigger: number;
  phaseLabel: string;
}

export interface DeliverabilityCheckResult {
  allowed: boolean;
  reason: string;
  nextAvailableTime?: Date;
}

export interface DeliverabilityHealth {
  healthy: boolean;
  totalSent: number;
  totalBounces: number;
  bounceRate: number;
  status: 'HEALTHY' | 'PAUSED_HIGH_BOUNCE' | 'DAILY_LIMIT_REACHED' | 'OUTSIDE_HOURS' | 'COOLDOWN_ACTIVE';
  statusMessage: string;
}

export const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes in ms (900,000 ms)

/**
 * Calculates the allowed daily send volume and per-trigger batch size based on campaign day.
 *
 * @param campaignDay - 1-indexed day of the active campaign
 */
export function getWarmUpTier(campaignDay: number): WarmUpTier {
  if (campaignDay <= 7) {
    return { maxSendsPerDay: 5, maxPerTrigger: 2, phaseLabel: 'Week 1 (Warm-Up)' };
  }
  if (campaignDay <= 14) {
    return { maxSendsPerDay: 10, maxPerTrigger: 3, phaseLabel: 'Week 2 (Ramp-Up)' };
  }
  if (campaignDay <= 21) {
    return { maxSendsPerDay: 15, maxPerTrigger: 4, phaseLabel: 'Week 3 (Scaling)' };
  }
  return { maxSendsPerDay: 20, maxPerTrigger: 5, phaseLabel: 'Week 4+ (Full Velocity)' };
}

/**
 * Converts a Date to UAE Gulf Standard Time (GST, UTC+4).
 */
export function getUaeDate(date: Date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 4 * 3600000); // UTC+4
}

/**
 * Checks if the given date is within UAE business hours (8:00 AM – 6:00 PM GST, Monday–Friday).
 */
export function isWithinUaeBusinessHours(date: Date = new Date()): boolean {
  const uae = getUaeDate(date);
  const day = uae.getDay(); // 0 = Sun, 6 = Sat
  const hour = uae.getHours();

  // UAE private sector corporate tech workweek is Monday (1) through Friday (5)
  // Standard business window: 08:00 (8 AM) through 17:59 (6 PM)
  const isWorkDay = day >= 1 && day <= 5;
  const isBusinessHour = hour >= 8 && hour < 18;

  return isWorkDay && isBusinessHour;
}

/**
 * Computes the next opening of the UAE business window if currently outside business hours.
 */
export function getNextBusinessWindow(date: Date = new Date()): Date {
  const uae = getUaeDate(date);
  const next = new Date(uae);

  while (!isWithinUaeBusinessHours(next)) {
    // Advance by 30 minutes until we hit business hours
    next.setMinutes(next.getMinutes() + 30);
  }

  // Convert back to UTC representation
  const offsetDiff = (next.getTimezoneOffset() + 4 * 60) * 60000;
  return new Date(next.getTime() - offsetDiff);
}

export class DeliverabilityShield {
  private warmUpStartDate: Date;
  private lastSendTimestamp: number;
  private sendsToday: number;
  private lastResetDateStr: string;
  private totalSent: number;
  private totalBounces: number;

  constructor(warmUpStartDate: Date = new Date()) {
    this.warmUpStartDate = warmUpStartDate;
    this.lastSendTimestamp = 0;
    this.sendsToday = 0;
    this.lastResetDateStr = new Date().toISOString().split('T')[0];
    this.totalSent = 0;
    this.totalBounces = 0;
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDateStr) {
      this.sendsToday = 0;
      this.lastResetDateStr = today;
    }
  }

  public getCampaignDay(): number {
    const msDiff = Date.now() - this.warmUpStartDate.getTime();
    const days = Math.floor(msDiff / (24 * 3600 * 1000)) + 1;
    return Math.max(1, days);
  }

  public getWarmUpTier(): WarmUpTier {
    return getWarmUpTier(this.getCampaignDay());
  }

  public canSendNow(now: Date = new Date(), options?: { enforceBusinessHours?: boolean }): DeliverabilityCheckResult {
    this.checkDailyReset();

    // 1. Health / Bounce circuit breaker check
    const health = this.getHealth();
    if (!health.healthy) {
      return {
        allowed: false,
        reason: `Deliverability paused due to high bounce rate (${(health.bounceRate * 100).toFixed(1)}% > 5%)`,
      };
    }

    // 2. Business hours check (optional for 24/7 continuous mode)
    if (options?.enforceBusinessHours && !isWithinUaeBusinessHours(now)) {
      const nextWindow = getNextBusinessWindow(now);
      return {
        allowed: false,
        reason: `Outside UAE business hours (8:00 AM - 6:00 PM GST Mon-Fri). Scheduled for next window.`,
        nextAvailableTime: nextWindow,
      };
    }

    // 3. Daily send budget check
    const tier = this.getWarmUpTier();
    if (this.sendsToday >= tier.maxSendsPerDay) {
      return {
        allowed: false,
        reason: `Daily warm-up limit reached (${this.sendsToday}/${tier.maxSendsPerDay} emails for ${tier.phaseLabel}).`,
      };
    }

    // 4. Fixed 15-minute cooldown check
    const elapsedSinceLastSend = now.getTime() - this.lastSendTimestamp;
    if (this.lastSendTimestamp > 0 && elapsedSinceLastSend < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - elapsedSinceLastSend;
      const nextAvailableTime = new Date(now.getTime() + remainingMs);
      return {
        allowed: false,
        reason: `15-minute anti-spam cooldown active (${Math.ceil(remainingMs / 60000)} minutes remaining).`,
        nextAvailableTime,
      };
    }

    return {
      allowed: true,
      reason: 'Deliverability checks passed. Safe to dispatch.',
    };
  }

  public recordSend(timestamp: number = Date.now()): void {
    this.checkDailyReset();
    this.lastSendTimestamp = timestamp;
    this.sendsToday += 1;
    this.totalSent += 1;
  }

  public recordBounce(): void {
    this.totalBounces += 1;
  }

  public getRemainingDailyBudget(): number {
    this.checkDailyReset();
    const tier = this.getWarmUpTier();
    return Math.max(0, tier.maxSendsPerDay - this.sendsToday);
  }

  public getHealth(): DeliverabilityHealth {
    const bounceRate = this.totalSent > 0 ? this.totalBounces / this.totalSent : 0;
    const isPaused = this.totalSent >= 10 && bounceRate > 0.05;

    let status: DeliverabilityHealth['status'] = 'HEALTHY';
    let statusMessage = 'Deliverability is optimal and healthy.';

    if (isPaused) {
      status = 'PAUSED_HIGH_BOUNCE';
      statusMessage = `Circuit breaker tripped: Bounce rate ${(bounceRate * 100).toFixed(1)}% exceeds 5% threshold.`;
    } else if (this.sendsToday >= this.getWarmUpTier().maxSendsPerDay) {
      status = 'DAILY_LIMIT_REACHED';
      statusMessage = `Daily send cap of ${this.getWarmUpTier().maxSendsPerDay} emails reached for today.`;
    }

    return {
      healthy: !isPaused,
      totalSent: this.totalSent,
      totalBounces: this.totalBounces,
      bounceRate: Number(bounceRate.toFixed(3)),
      status,
      statusMessage,
    };
  }

  public reset(startDate?: Date): void {
    this.warmUpStartDate = startDate || new Date();
    this.lastSendTimestamp = 0;
    this.sendsToday = 0;
    this.totalSent = 0;
    this.totalBounces = 0;
  }
}

export const globalDeliverabilityShield = new DeliverabilityShield();

export function canSendNow(date?: Date, options?: { enforceBusinessHours?: boolean }): DeliverabilityCheckResult {
  return globalDeliverabilityShield.canSendNow(date, options);
}

export function recordSend(timestamp?: number): void {
  globalDeliverabilityShield.recordSend(timestamp);
}

export function recordBounce(): void {
  globalDeliverabilityShield.recordBounce();
}

export function getDeliverabilityHealth(): DeliverabilityHealth {
  return globalDeliverabilityShield.getHealth();
}

export function getRemainingDailyBudget(): number {
  return globalDeliverabilityShield.getRemainingDailyBudget();
}
