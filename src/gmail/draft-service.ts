import { google } from 'googleapis';
import { getEnv } from '../config/env.js';
import { throttle } from '../rate-limiter/token-bucket.js';
import { getCachedProfile } from '../profile/profile-loader.js';
import { generateDocumentFileName } from '../utils/file-naming.js';

export interface CreateDraftOptions {
  toEmails: string[];
  subject: string;
  bodyText: string;
  resumePdfBuffer: Buffer;
  resumeFileName?: string;
  coverLetterPdfBuffer?: Buffer;
  coverLetterFileName?: string;
}

export interface GmailDraftResult {
  draftId: string;
  messageId: string;
}

/**
 * Returns a dynamic set of excluded emails (candidate's own emails and storage account).
 */
export function getExcludedEmails(): Set<string> {
  const excluded = new Set<string>();
  try {
    const profile = getCachedProfile();
    if (profile.email) excluded.add(profile.email.toLowerCase().trim());
  } catch {
    // profile not loaded yet
  }

  try {
    const env = getEnv();
    if (env.GMAIL_SENDER_EMAIL) excluded.add(env.GMAIL_SENDER_EMAIL.toLowerCase().trim());
    if (env.GOOGLE_STORAGE_USER_EMAIL) excluded.add(env.GOOGLE_STORAGE_USER_EMAIL.toLowerCase().trim());
  } catch {
    // env not loaded yet
  }

  return excluded;
}

/**
 * Sanitizes and filters outreach recipient emails to ensure candidate's own emails are never in the To header.
 */
export function filterOutreachRecipients(emails: string[]): string[] {
  const excluded = getExcludedEmails();
  return emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .filter((e) => !excluded.has(e));
}

/**
 * Builds an RFC 2822 multipart/mixed MIME message string and returns both raw text and base64url encoded representation.
 */
export function buildMimeMessage(options: CreateDraftOptions): { rawMime: string; base64Url: string } {
  let profileName = 'Candidate';
  let profileEmail = '';
  try {
    const profile = getCachedProfile();
    profileName = profile.name || 'Candidate';
    profileEmail = profile.email || '';
  } catch {
    // fallback
  }

  const env = getEnv();
  const senderEmail = env.GMAIL_SENDER_EMAIL || profileEmail || 'careers@company.com';
  const boundary = `__boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`;
  const nl = '\r\n';

  const validRecipients = filterOutreachRecipients(options.toEmails);
  const toHeader = validRecipients.length > 0 ? validRecipients.join(', ') : 'careers@company.com';

  const resumeFileName = options.resumeFileName || generateDocumentFileName('CV', undefined, undefined, profileName);
  const coverLetterFileName = options.coverLetterFileName || generateDocumentFileName('CoverLetter', undefined, undefined, profileName);

  const subjectEncoded = `=?UTF-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=`;

  const headers = [
    `From: ${profileName} <${senderEmail}>`,
    `To: ${toHeader}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const bodyParts: string[] = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    options.bodyText,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${resumeFileName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${resumeFileName}"`,
    '',
    options.resumePdfBuffer.toString('base64'),
  ];

  if (options.coverLetterPdfBuffer) {
    bodyParts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${coverLetterFileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${coverLetterFileName}"`,
      '',
      options.coverLetterPdfBuffer.toString('base64')
    );
  }

  bodyParts.push(`--${boundary}--`);

  const rawMime = headers.join(nl) + nl + nl + bodyParts.join(nl);
  const base64Url = Buffer.from(rawMime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { rawMime, base64Url };
}

function getGmailClient(): any {
  const env = getEnv();
  const auth = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: auth as any });
}

/**
 * Creates a Gmail draft with multiple recipients and dual PDF attachments in Account 2.
 *
 * @param options - Recipient emails, subject, body, and PDF attachment buffers
 * @returns Draft ID and initial Message ID
 */
export async function createMultiRecipientGmailDraft(
  options: CreateDraftOptions
): Promise<GmailDraftResult> {
  await throttle('gmail');

  const { base64Url } = buildMimeMessage(options);
  const gmail = getGmailClient();

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: base64Url,
      },
    },
  });

  const draftId = res.data.id || '';
  const messageId = res.data.message?.id || '';

  if (!draftId) {
    throw new Error('Gmail API failed to return draft ID');
  }

  return { draftId, messageId };
}

/**
 * Sends an existing Gmail draft after explicit human approval.
 *
 * @param draftId - The ID of the approved draft
 */
export async function sendApprovedGmailDraft(draftId: string): Promise<{ messageId: string }> {
  await throttle('gmail');

  const gmail = getGmailClient();
  const res = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: {
      id: draftId,
    },
  });

  return {
    messageId: res.data.id || draftId,
  };
}

/**
 * Resilient draft sender: Sends by draftId, or searches Gmail account drafts
 * matching the job recipient/subject to guarantee reliable sending even across serverless boundaries.
 */
export async function sendDraftForJob(options: {
  draftId?: string;
  toEmails?: string[];
  jobTitle?: string;
  companyName?: string;
}): Promise<{ sent: boolean; messageId: string }> {
  await throttle('gmail');
  const gmail = getGmailClient();

  // 1. If explicit draftId is provided, attempt to send directly
  if (options.draftId && options.draftId !== 'undefined' && options.draftId !== 'none') {
    try {
      const res = await gmail.users.drafts.send({
        userId: 'me',
        requestBody: {
          id: options.draftId,
        },
      });
      console.log(`[DraftService] Sent draft by direct ID: ${options.draftId}`);
      return { sent: true, messageId: res.data.id || options.draftId };
    } catch (err: any) {
      console.warn(`[DraftService] Direct send by draftId (${options.draftId}) failed: ${err.message}. Searching Gmail drafts...`);
    }
  }

  // 2. Search recent Gmail drafts for matching recipient or subject
  try {
    const listRes = await gmail.users.drafts.list({
      userId: 'me',
      maxResults: 25,
    });

    const drafts = listRes.data.drafts || [];
    for (const d of drafts) {
      if (!d.id) continue;
      try {
        const draftDetail = await gmail.users.drafts.get({
          userId: 'me',
          id: d.id,
          format: 'metadata',
        });

        const headers: any[] = draftDetail.data.message?.payload?.headers || [];
        const toHeader = (headers.find((h: any) => h.name?.toLowerCase() === 'to')?.value || '').toLowerCase();
        const subjectHeader = (headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '').toLowerCase();

        // Check if recipient email matches
        const matchesEmail = options.toEmails && options.toEmails.some((email) => email && (toHeader.includes(email.toLowerCase()) || email.toLowerCase().includes(toHeader)));

        // Check if job title matches in subject
        const cleanJobTitle = (options.jobTitle || '').toLowerCase().trim();
        const matchesSubject = cleanJobTitle.length > 0 && (
          subjectHeader.includes(cleanJobTitle) ||
          cleanJobTitle.split(/\s+/).filter((w) => w.length > 3).some((w) => subjectHeader.includes(w))
        );

        // Check if company matches in subject or recipient
        const cleanCompany = (options.companyName || '').toLowerCase().trim();
        const matchesCompany = cleanCompany.length > 0 && (
          subjectHeader.includes(cleanCompany) ||
          toHeader.includes(cleanCompany) ||
          cleanCompany.split(/\s+/).filter((w) => w.length > 3).some((w) => subjectHeader.includes(w))
        );

        if (matchesEmail || (matchesSubject && matchesCompany) || (matchesSubject && cleanJobTitle.length > 5)) {
          console.log(`[DraftService] Found matching Gmail draft ${d.id} (Subject: "${subjectHeader}", To: "${toHeader}"). Dispatching...`);
          const sendRes = await gmail.users.drafts.send({
            userId: 'me',
            requestBody: {
              id: d.id,
            },
          });
          return { sent: true, messageId: sendRes.data.id || d.id };
        }
      } catch (err: any) {
        console.warn(`[DraftService] Error inspecting draft ${d.id}:`, err.message);
      }
    }
  } catch (searchErr: any) {
    console.warn(`[DraftService] Error searching drafts in Gmail: ${searchErr.message}`);
  }

  throw new Error(
    `No matching Gmail draft found in your account for "${options.jobTitle || 'this job'}" to ${options.toEmails?.join(', ') || 'recruiter'}.`
  );
}

/**
 * Deletes a Gmail draft (useful for testing or rejected outreach cards).
 *
 * @param draftId - The ID of the draft to delete
 */
export async function deleteGmailDraft(draftId: string): Promise<boolean> {
  await throttle('gmail');

  const gmail = getGmailClient();
  await gmail.users.drafts.delete({
    userId: 'me',
    id: draftId,
  });

  return true;
}
