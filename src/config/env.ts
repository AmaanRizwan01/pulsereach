/**
 * Pulsereach — Environment Configuration & Secrets Validation
 * Validates and exposes strongly typed environment variables with fail-fast diagnostics.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

/**
 * Diagnostic guidance map for missing or invalid configuration keys.
 */
const ENV_HELP_GUIDE: Record<string, string> = {
  GOOGLE_SHEET_ID: 'Found in your Google Sheet URL: https://docs.google.com/spreadsheets/d/{ID}/edit',
  GOOGLE_SPREADSHEET_ID: 'Found in your Google Sheet URL: https://docs.google.com/spreadsheets/d/{ID}/edit',
  GOOGLE_CLIENT_ID: 'Obtain from Google Cloud Console (APIs & Services > Credentials)',
  GOOGLE_CLIENT_SECRET: 'Obtain from Google Cloud Console (APIs & Services > Credentials)',
  GOOGLE_STORAGE_USER_EMAIL: 'Email address of the Google Drive / Sheets storage account',
  GOOGLE_STORAGE_REFRESH_TOKEN: 'OAuth2 Refresh token for Storage/Sheets account',
  GMAIL_SENDER_EMAIL: 'Primary candidate outreach email address for sending applications',
  GMAIL_REFRESH_TOKEN: 'OAuth2 Refresh token for Candidate Outreach Gmail account',
  GEMINI_API_KEY: 'Generate a free API key at Google AI Studio: https://aistudio.google.com/',
  TELEGRAM_BOT_TOKEN: 'Create a bot and get the token from @BotFather on Telegram',
  TELEGRAM_CHAT_ID: 'Get your personal Telegram Chat ID from @userinfobot or @getidsbot',
  WEBHOOK_SECRET: 'Set a random secure string (min 8 chars) to authenticate Google Apps Script triggers',
};

/**
 * Zod schema for all required and optional runtime environment variables.
 */
export const envSchema = z.object({
  // Google Sheets & Storage Account
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_STORAGE_USER_EMAIL: z.string().email().optional(),
  GOOGLE_STORAGE_REFRESH_TOKEN: z.string().optional(),

  // Google OAuth2 Shared Client Credentials
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),

  // Candidate Gmail Outreach Account
  GMAIL_SENDER_EMAIL: z.string().email({ message: 'GMAIL_SENDER_EMAIL must be a valid email address' }).default('you@example.com'),
  GMAIL_REFRESH_TOKEN: z.string({ required_error: 'GMAIL_REFRESH_TOKEN is required' }).min(1),

  // Google Gemini AI
  GEMINI_API_KEY: z
    .string({ required_error: 'GEMINI_API_KEY is required' })
    .min(1, 'GEMINI_API_KEY cannot be empty'),
  AI_MODEL: z.string().default('gemini-2.0-flash'),
  AI_MATCHING_MODEL: z.string().default('gemini-2.0-flash'),
  AI_TAILORING_MODEL: z.string().default('gemini-2.0-flash'),
  AI_CLASSIFIER_MODEL: z.string().default('gemini-2.0-flash'),

  // Telegram Cockpit
  TELEGRAM_BOT_TOKEN: z
    .string({ required_error: 'TELEGRAM_BOT_TOKEN is required' })
    .regex(/^\d+:[A-Za-z0-9_-]+$/, 'Invalid TELEGRAM_BOT_TOKEN format (expected format: 123456789:ABCdef...)'),
  TELEGRAM_CHAT_ID: z
    .string({ required_error: 'TELEGRAM_CHAT_ID is required' })
    .min(1, 'TELEGRAM_CHAT_ID cannot be empty'),

  // Pipeline Webhook Security & GitHub Actions Dispatch
  WEBHOOK_SECRET: z
    .string({ required_error: 'WEBHOOK_SECRET is required' })
    .min(8, 'WEBHOOK_SECRET must be at least 8 characters long'),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().default('pulsereach'),

  // Managed Supabase (Profile & State Store)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),

  // Fallback Cron & Runtime Environment
  CRON_SCHEDULE: z.string().default('0 */2 * * *'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).transform((raw) => {
  // Normalize Google OAuth client ID and Secret
  const clientId = raw.GOOGLE_CLIENT_ID || raw.GMAIL_CLIENT_ID;
  const clientSecret = raw.GOOGLE_CLIENT_SECRET || raw.GMAIL_CLIENT_SECRET;
  const sheetId = raw.GOOGLE_SPREADSHEET_ID || raw.GOOGLE_SHEET_ID;
  const sheetsRefreshToken = raw.GOOGLE_STORAGE_REFRESH_TOKEN || raw.GMAIL_REFRESH_TOKEN;

  if (!clientId) {
    throw new Error('❌ Missing GOOGLE_CLIENT_ID or GMAIL_CLIENT_ID');
  }
  if (!clientSecret) {
    throw new Error('❌ Missing GOOGLE_CLIENT_SECRET or GMAIL_CLIENT_SECRET');
  }
  if (!sheetId) {
    throw new Error('❌ Missing GOOGLE_SPREADSHEET_ID or GOOGLE_SHEET_ID');
  }

  return {
    ...raw,
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GMAIL_CLIENT_ID: clientId,
    GMAIL_CLIENT_SECRET: clientSecret,
    GOOGLE_SHEET_ID: sheetId,
    GOOGLE_SPREADSHEET_ID: sheetId,
    GOOGLE_STORAGE_REFRESH_TOKEN: sheetsRefreshToken,
  };
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

/**
 * Formats Zod errors into a clean, actionable terminal diagnostic block.
 */
function formatDiagnosticError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const key = issue.path.join('.');
    const help = ENV_HELP_GUIDE[key];
    const helpText = help ? `\n      💡 Hint: ${help}` : '';
    return `   • [${key}]: ${issue.message}${helpText}`;
  });

  return [
    '================================================================================',
    '❌ CRITICAL CONFIGURATION ERROR — Missing or invalid environment variables:',
    '================================================================================',
    ...issues,
    '',
    '👉 Please update your .env file or deployment environment variables before proceeding.',
    '================================================================================',
  ].join('\n');
}

/**
 * Validates and retrieves the strongly typed application environment configuration.
 * Results are cached in memory for subsequent calls.
 *
 * @throws {Error} If environment validation fails
 */
export function getEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formattedError = formatDiagnosticError(result.error);
    throw new Error(formattedError);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Resets the in-memory cached environment configuration.
 * Useful for isolated unit testing with mocked environment variables.
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
