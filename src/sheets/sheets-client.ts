/**
 * Pulsereach — Google Sheets Data Ingestion & Contact Parser
 * Fetches and parses job listings from Google Sheets API v4 (Columns A through N),
 * with resilient email sanitization, markdown link cleaning, and two-way status write-backs.
 */

import { google, sheets_v4 } from 'googleapis';
import { getEnv } from '../config/env.js';
import { throttle } from '../rate-limiter/token-bucket.js';

/**
 * Strongly typed representation of a parsed job row from Google Sheets (Columns A through N).
 */
export interface SheetJobRow {
  /** 1-indexed row number in the spreadsheet (Row 2 = index 0) */
  rowNumber: number;
  /** Column A: Date listing was fetched/added */
  dateFetched: string;
  /** Column B: Target Job Title */
  jobTitle: string;
  /** Column C: Company / Employer Name */
  companyName: string;
  /** Column D: Work Location (e.g. Dubai, Abu Dhabi, Remote) */
  location: string;
  /** Column E: Domain / Technical Category */
  domainCategory: string;
  /** Column F: Cleaned list of contact email addresses */
  contactEmails: string[];
  /** Column G: Recruiter or Decision Maker LinkedIn profile URL */
  recruiterLinkedIn?: string;
  /** Column H: Direct application or careers portal URL */
  applicationLink: string;
  /** Column I: Outreach strategy notes or recruiter guidance */
  outreachStrategy: string;
  /** Column J: ATS keywords and exact phrasing to emphasize */
  atsKeywordsAndPhrasing: string;
  /** Column K: Current application status (e.g. "Applied (Email Sent)", "Applied (Portal)", "Draft Created", "Skipped") */
  status?: string;
  /** Column L: Date applied / status timestamp */
  appliedAt?: string;
  /** Column M: Direct Google Drive link to compiled CV */
  cvLink?: string;
  /** Column N: Direct Google Drive link to compiled Cover Letter */
  coverLetterLink?: string;
  /** Raw row array values as returned by the API */
  rawRow: string[];
}

let sheetsClientInstance: sheets_v4.Sheets | null = null;

/**
 * Extracts clean HTTP/HTTPS URL from raw strings or markdown links (e.g. "[url](url)").
 */
export function cleanUrl(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/https?:\/\/[^\s\]\)\>]+/i);
  return match ? match[0] : raw.trim();
}

/**
 * Extracts, sanitizes, validates, and deduplicates email addresses from raw text.
 * Supports comma, semicolon, newline, and tab separators as well as `<name@domain.com>` brackets.
 * Returns empty array if "Email Not Found" or no valid emails exist.
 *
 * @param rawEmails - Raw string input from Sheet Column F
 * @returns Array of unique, valid lowercase email addresses
 */
export function parseContactEmails(rawEmails: string | null | undefined): string[] {
  if (!rawEmails || typeof rawEmails !== 'string') {
    return [];
  }

  // 1. Remove angled brackets around emails (e.g. "HR Team <hr@company.ae>" -> "HR Team hr@company.ae")
  const sanitized = rawEmails.replace(/<([^>]+)>/g, '$1');

  // 2. Split on comma, semicolon, newline, carriage return, or tab
  const tokens = sanitized.split(/[,;\n\r\t]+/);

  // RFC 5322 compatible regex for email verification
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  const validEmails = new Set<string>();

  for (const token of tokens) {
    const trimmed = token.trim().toLowerCase();
    const senderEmail = process.env.GMAIL_SENDER_EMAIL?.toLowerCase().trim();
    const storageEmail = process.env.GOOGLE_STORAGE_USER_EMAIL?.toLowerCase().trim();
    // In case a token still contains name prefix e.g. "hr: a@b.com"
    const words = trimmed.split(/\s+/);
    for (const word of words) {
      if (
        word &&
        emailRegex.test(word) &&
        (!senderEmail || word !== senderEmail) &&
        (!storageEmail || word !== storageEmail)
      ) {
        validEmails.add(word);
      }
    }
  }

  return Array.from(validEmails);
}

/**
 * Parses a single raw row array from Google Sheets into a strongly-typed SheetJobRow.
 * Compatible with the 10-column input schema (Columns A through J) + 4 write-back columns (K through N).
 *
 * @param rawRow - Raw array of cell string values
 * @param index - Zero-based index of row within fetched range
 * @returns Parsed SheetJobRow or null if invalid/empty
 */
export function parseSheetRow(rawRow: unknown[], index: number): SheetJobRow | null {
  if (!rawRow || !Array.isArray(rawRow) || rawRow.length === 0) {
    return null;
  }

  // Safe accessor handling sparse arrays where trailing cells are omitted
  const getCell = (idx: number): string =>
    rawRow[idx] !== undefined && rawRow[idx] !== null ? String(rawRow[idx]).trim() : '';

  const dateFetched = getCell(0);
  const jobTitle = getCell(1);
  const companyName = getCell(2);
  const location = getCell(3) || 'UAE';
  const domainCategory = getCell(4);
  const rawEmails = getCell(5);
  const rawLinkedIn = getCell(6);
  const rawAppUrl = getCell(7);
  const outreachStrategy = getCell(8);
  const atsKeywordsAndPhrasing = getCell(9);
  const status = getCell(10);
  const appliedAt = getCell(11);
  const cvLink = getCell(12);
  const coverLetterLink = getCell(13);

  // Filter out blank rows or spacer rows
  if (!jobTitle && !companyName) {
    return null;
  }

  const recruiterLinkedIn = cleanUrl(rawLinkedIn);
  const applicationLink = cleanUrl(rawAppUrl);

  return {
    rowNumber: index + 2, // Range starts at A2, so index 0 = Row 2
    dateFetched,
    jobTitle,
    companyName,
    location,
    domainCategory,
    contactEmails: parseContactEmails(rawEmails),
    recruiterLinkedIn: recruiterLinkedIn || undefined,
    applicationLink,
    outreachStrategy,
    atsKeywordsAndPhrasing,
    status: status || undefined,
    appliedAt: appliedAt || undefined,
    cvLink: cvLink || undefined,
    coverLetterLink: coverLetterLink || undefined,
    rawRow: rawRow.map((cell) => (cell !== undefined && cell !== null ? String(cell) : '')),
  };
}

/**
 * Retrieves the singleton authenticated Google Sheets API v4 client.
 * Uses Google Account 1 (Storage/Sheets) credentials with fallback to outreach account.
 */
export function getGoogleSheetsClient(): sheets_v4.Sheets {
  if (sheetsClientInstance) {
    return sheetsClientInstance;
  }

  const env = getEnv();
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: env.GOOGLE_STORAGE_REFRESH_TOKEN || env.GMAIL_REFRESH_TOKEN,
  });

  sheetsClientInstance = google.sheets({
    version: 'v4',
    auth: oauth2Client as any,
  });

  return sheetsClientInstance;
}

/**
 * Resets the Google Sheets client instance (useful for unit testing or credential switching).
 */
export function resetSheetsClient(): void {
  sheetsClientInstance = null;
}

/**
 * Fetches all available job rows from Google Sheet range A2:N and parses them into typed models.
 *
 * @param options - Optional override for sheet ID or range
 * @returns Promise resolving to an array of valid SheetJobRow items
 */
export async function fetchLatestJobsFromSheet(options?: {
  range?: string;
  sheetId?: string;
}): Promise<SheetJobRow[]> {
  const env = getEnv();
  const spreadsheetId = options?.sheetId || env.GOOGLE_SPREADSHEET_ID || env.GOOGLE_SHEET_ID;
  const range = options?.range || 'A2:N';
  const sheets = getGoogleSheetsClient();

  try {
    await throttle('sheets');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const parsedJobs: SheetJobRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = parseSheetRow(rows[i], i);
      if (parsed) {
        parsedJobs.push(parsed);
      }
    }

    return parsedJobs;
  } catch (error: any) {
    console.error(`❌ Google Sheets API Error (Sheet: ${spreadsheetId}, Range: ${range}):`, error.message);
    throw error;
  }
}

/**
 * Updates status, date, CV link, and Cover Letter link in Columns K, L, M, N of a given row in Google Sheets.
 *
 * @param rowNumber - 1-indexed row number in the spreadsheet (Row 2 = index 0)
 * @param status - Human-readable status (e.g. "Draft Created", "Applied (Email Sent)", "Applied (Portal)", "Skipped", "Not Relevant")
 * @param options - Optional additional fields: appliedAt, resumeDriveUrl, coverLetterDriveUrl, error
 */
export async function updateSheetJobStatus(
  rowNumber: number,
  status: string,
  options?: {
    appliedAt?: string;
    resumeDriveUrl?: string;
    coverLetterDriveUrl?: string;
    error?: string;
    sheetId?: string;
  }
): Promise<boolean> {
  const env = getEnv();
  const spreadsheetId = options?.sheetId || env.GOOGLE_SPREADSHEET_ID || env.GOOGLE_SHEET_ID;
  const sheets = getGoogleSheetsClient();
  const range = `K${rowNumber}:N${rowNumber}`;

  const appliedDate = options?.appliedAt || new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' });
  const cvLink = options?.resumeDriveUrl || options?.error || '';
  const clLink = options?.coverLetterDriveUrl || '';

  try {
    await throttle('sheets');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status, appliedDate, cvLink, clLink]],
      },
    });
    return true;
  } catch (error: any) {
    console.warn(`⚠️ [SheetsClient] Failed to update status for Row ${rowNumber}: ${error.message}`);
    return false;
  }
}
