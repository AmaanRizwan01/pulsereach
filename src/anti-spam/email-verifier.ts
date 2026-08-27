import dns from 'dns';
import dnsPromises from 'dns/promises';

export type EmailVerificationFailureReason =
  | 'SYNTAX_ERROR'
  | 'ROLE_BASED_NOREPLY'
  | 'PLACEHOLDER_DOMAIN'
  | 'DISPOSABLE_DOMAIN'
  | 'NO_MX_RECORDS'
  | 'DNS_TIMEOUT'
  | 'SELF_SENDER_EMAIL';

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  isDeliverable: boolean;
  reason?: EmailVerificationFailureReason;
  domain?: string;
  mxHost?: string;
}

// In-memory DNS cache: domain -> { hasMx: boolean, mxHost?: string, checkedAt: number }
interface CachedDomainInfo {
  hasMx: boolean;
  mxHost?: string;
  checkedAt: number;
}

const DOMAIN_CACHE = new Map<string, CachedDomainInfo>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// RFC 5322 compatible regex
const RFC_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Obvious placeholder domains
const PLACEHOLDER_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'sample.com',
  'sample.ae',
  'domain.com',
  'company.com',
  'dummy.com',
  'placeholder.com',
  'placeholder.ae',
  'mycompany.com',
  'yourcompany.com',
]);

// Known disposable/temporary email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getairmail.com',
]);

// Blacklisted unmonitored / system local-parts
const NOREPLY_LOCAL_PARTS = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'abuse',
  'privacy',
  'root',
  'admin-noreply',
  'notification',
  'notifications',
]);

// Initialize reliable public DNS resolvers (Google + Cloudflare) for consistent cross-platform resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Use default system resolver if custom servers cannot be bound
}

/**
 * Resolves MX records for a domain with a fast timeout and in-memory caching.
 */
export async function checkDomainMxRecords(
  domain: string,
  timeoutMs: number = 3000
): Promise<{ hasMx: boolean; mxHost?: string }> {
  const normalizedDomain = domain.trim().toLowerCase();

  // 1. Check in-memory cache
  const cached = DOMAIN_CACHE.get(normalizedDomain);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return { hasMx: cached.hasMx, mxHost: cached.mxHost };
  }

  // 2. DNS MX lookup with timeout
  try {
    const mxLookup = dnsPromises.resolveMx(normalizedDomain);
    const timeoutPromise = new Promise<dns.MxRecord[]>((_, reject) =>
      setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs)
    );

    const records = await Promise.race([mxLookup, timeoutPromise]);

    if (records && records.length > 0) {
      // Sort by priority (lowest number = highest priority)
      records.sort((a, b) => a.priority - b.priority);
      const primaryMx = records[0].exchange;

      const result = { hasMx: true, mxHost: primaryMx };
      DOMAIN_CACHE.set(normalizedDomain, { ...result, checkedAt: Date.now() });
      return result;
    }
  } catch (err: any) {
    if (err.message !== 'DNS_TIMEOUT') {
      // Fallback: Check for standard A record (RFC 5321 implicit MX fallback)
      try {
        const aLookup = dnsPromises.resolve4(normalizedDomain);
        const aTimeout = new Promise<string[]>((_, reject) =>
          setTimeout(() => reject(new Error('DNS_TIMEOUT')), 1500)
        );
        const aRecords = await Promise.race([aLookup, aTimeout]);
        if (aRecords && aRecords.length > 0) {
          const result = { hasMx: true, mxHost: normalizedDomain };
          DOMAIN_CACHE.set(normalizedDomain, { ...result, checkedAt: Date.now() });
          return result;
        }
      } catch {}
    }
  }

  const result = { hasMx: false };
  DOMAIN_CACHE.set(normalizedDomain, { ...result, checkedAt: Date.now() });
  return result;
}

/**
 * Performs a comprehensive 4-tier verification on a candidate email address.
 *
 * @param email - Raw or sanitized email address
 * @returns Strongly typed verification result with failure diagnosis
 */
export async function verifyEmailDeliverability(email: string): Promise<EmailVerificationResult> {
  if (!email || typeof email !== 'string') {
    return { email: '', isValid: false, isDeliverable: false, reason: 'SYNTAX_ERROR' };
  }

  // Strip brackets and trim
  const cleanEmail = email.replace(/<([^>]+)>/g, '$1').trim().toLowerCase();

  // Tier 1: Syntax & Character Validation
  if (!RFC_EMAIL_REGEX.test(cleanEmail)) {
    return { email: cleanEmail, isValid: false, isDeliverable: false, reason: 'SYNTAX_ERROR' };
  }

  const [localPart, domain] = cleanEmail.split('@');
  if (!localPart || !domain || !domain.includes('.')) {
    return { email: cleanEmail, isValid: false, isDeliverable: false, reason: 'SYNTAX_ERROR', domain };
  }

  // Check self sender exclusion
  let isSelfSender = false;
  try {
    const senderEmail = process.env.GMAIL_SENDER_EMAIL?.toLowerCase().trim();
    const storageEmail = process.env.GOOGLE_STORAGE_USER_EMAIL?.toLowerCase().trim();
    if (senderEmail && cleanEmail === senderEmail) isSelfSender = true;
    if (storageEmail && cleanEmail === storageEmail) isSelfSender = true;
  } catch {
    // ignore
  }

  if (isSelfSender) {
    return {
      email: cleanEmail,
      isValid: true,
      isDeliverable: false,
      reason: 'SELF_SENDER_EMAIL',
      domain,
    };
  }

  // Tier 2A: Blacklisted No-Reply Mailboxes
  if (NOREPLY_LOCAL_PARTS.has(localPart)) {
    return {
      email: cleanEmail,
      isValid: true,
      isDeliverable: false,
      reason: 'ROLE_BASED_NOREPLY',
      domain,
    };
  }

  // Tier 2B: Placeholder & Dummy Domains
  if (PLACEHOLDER_DOMAINS.has(domain)) {
    return {
      email: cleanEmail,
      isValid: false,
      isDeliverable: false,
      reason: 'PLACEHOLDER_DOMAIN',
      domain,
    };
  }

  // Tier 2C: Disposable / Burner Email Providers
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      email: cleanEmail,
      isValid: true,
      isDeliverable: false,
      reason: 'DISPOSABLE_DOMAIN',
      domain,
    };
  }

  // Tier 3: Real-Time DNS MX Resolution
  const mxCheck = await checkDomainMxRecords(domain);
  if (!mxCheck.hasMx) {
    return {
      email: cleanEmail,
      isValid: true,
      isDeliverable: false,
      reason: 'NO_MX_RECORDS',
      domain,
    };
  }

  // Tier 4: Verified Real Email Address
  return {
    email: cleanEmail,
    isValid: true,
    isDeliverable: true,
    domain,
    mxHost: mxCheck.mxHost,
  };
}

/**
 * Filters an array of contact emails and returns only verified, deliverable email addresses.
 * Runs verification asynchronously across all candidates in parallel.
 *
 * @param emails - List of contact emails from Google Sheet
 * @returns List of verified, deliverable email strings
 */
export async function filterDeliverableEmails(emails: string[]): Promise<string[]> {
  if (!emails || emails.length === 0) {
    return [];
  }

  const results = await Promise.all(emails.map((e) => verifyEmailDeliverability(e)));
  const deliverable: string[] = [];

  for (const res of results) {
    if (res.isDeliverable) {
      deliverable.push(res.email);
    } else {
      console.log(`  🛡️ [EmailVerifier] Rejected non-deliverable email: "${res.email}" (Reason: ${res.reason || 'UNKNOWN'})`);
    }
  }

  return deliverable;
}

/**
 * Resets the in-memory domain DNS cache (useful for testing).
 */
export function resetDomainCache(): void {
  DOMAIN_CACHE.clear();
}
