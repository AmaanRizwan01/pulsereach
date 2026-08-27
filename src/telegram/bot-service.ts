/**
 * Pulsereach — Telegram Cockpit & Interactive Mobile Bot
 * Formats clean, high-signal review cards with email draft previews or portal application summaries,
 * manages inline callbacks, and streams single-page A4 CV & Cover Letter PDFs on-demand.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { getEnv } from '../config/env.js';
import { throttle } from '../rate-limiter/token-bucket.js';
import { removeEmDashes } from '../ai/email-generator.js';
import { sendDraftForJob } from '../gmail/draft-service.js';
import { downloadDrivePdfBuffer } from '../drive/drive-service.js';
import { compileResumePdf, compileCoverLetterPdf } from '../ai/pdf-compiler.js';
import { generateTailoredResumeData } from '../ai/resume-tailorer.js';
import { generateTailoredCoverLetter } from '../ai/cover-letter-generator.js';
import {
  getJobRecord,
  approveJobApplication,
  skipJobApplication,
  markJobNotRelevant,
  clearActiveJobKey,
  clearAllLocks,
  loadState,
  getActiveJobKey,
  filterUnprocessedJobs,
  generateJobKey,
} from '../worker/state-tracker.js';
import { updateSheetJobStatus, fetchLatestJobsFromSheet } from '../sheets/sheets-client.js';
import { processSingleJobJustInTime } from '../worker/pipeline.js';
import { generateDocumentFileName, extractJobMetadataFromCardText } from '../utils/file-naming.js';

export interface JobCardData {
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  matchScore: number;
  atsScore: number;
  domainCategory?: string;
  recruiterName?: string;
  recipientEmails: string[];
  recruiterLinkedIn?: string;
  applicationLink?: string;
  outreachStrategy?: string;
  inMailSubject?: string;
  linkedInMessage?: string;
  emailSubject?: string;
  emailBodyText?: string;
  draftId?: string;
  resumeDriveUrl?: string;
  coverLetterDriveUrl?: string;
  isPortalLead?: boolean;
  rowNumber?: number;
}

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineButton[][];
}

// In-memory caches for PDF buffers to serve on-demand [📄 Send CV] & [📝 Send CL] button clicks
const pdfBufferCache = new Map<string, { buffer: Buffer; fileName: string }>();
const clBufferCache = new Map<string, { buffer: Buffer; fileName: string }>();

export function cacheJobPdf(jobId: string, buffer: Buffer, fileName: string): void {
  pdfBufferCache.set(jobId, { buffer, fileName });
  if (jobId.length > 32) {
    pdfBufferCache.set(jobId.slice(0, 32), { buffer, fileName });
  }
}

export function getCachedJobPdf(jobId: string): { buffer: Buffer; fileName: string } | undefined {
  return pdfBufferCache.get(jobId);
}

export function cacheJobCoverLetter(jobId: string, buffer: Buffer, fileName: string): void {
  clBufferCache.set(jobId, { buffer, fileName });
  if (jobId.length > 32) {
    clBufferCache.set(jobId.slice(0, 32), { buffer, fileName });
  }
}

export function getCachedJobCoverLetter(jobId: string): { buffer: Buffer; fileName: string } | undefined {
  return clBufferCache.get(jobId);
}

export function clearPdfCache(): void {
  pdfBufferCache.clear();
  clBufferCache.clear();
}

/**
 * Strips HTML tags and entities for safe inclusion in Telegram message bodies.
 */
function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formats a clean, high-signal HTML review card for the Telegram mobile cockpit.
 * Tailors card presentation for Email Leads vs. Direct Portal Leads.
 */
export function formatTelegramCardHtml(data: JobCardData, _campaignDay: number = 1): string {
  const company = escapeHtml(data.companyName);
  const title = escapeHtml(data.jobTitle);
  const location = escapeHtml(data.location || 'UAE');
  const isPortal = data.isPortalLead || data.recipientEmails.length === 0;
  const atsScoreText =
    typeof data.atsScore === 'number' && data.atsScore > 0
      ? `${data.atsScore}/100`
      : '⚠️ N/A (Review Needed)';

  // Header Links
  const driveLinks: string[] = [];
  if (data.resumeDriveUrl) driveLinks.push(`<a href="${data.resumeDriveUrl}">📁 CV</a>`);
  if (data.coverLetterDriveUrl) driveLinks.push(`<a href="${data.coverLetterDriveUrl}">📝 Cover Letter</a>`);
  const docsHtml = driveLinks.length > 0 ? ` • ${driveLinks.join(' | ')}` : '';

  const linkedinHtml = data.recruiterLinkedIn
    ? `\n💼 <b>LinkedIn:</b> <a href="${data.recruiterLinkedIn}">Recruiter / Company Profile</a>`
    : '';

  if (isPortal) {
    // Portal Application Lead Layout
    const portalUrl = data.applicationLink
      ? `\n🔗 <b>Portal Link:</b> <a href="${data.applicationLink}">Open Careers Portal</a>`
      : '';

    const inMailSubject = data.inMailSubject || data.emailSubject;
    const subjectSnippet = inMailSubject
      ? `\n\n📝 <b>InMail Subject:</b> <i>${escapeHtml(inMailSubject)}</i>`
      : '';

    const messageContent = data.linkedInMessage || data.outreachStrategy;
    const messageSnippet = messageContent
      ? `\n💬 <b>LinkedIn Message:</b> <i>(Tap block to copy)</i>\n<blockquote>${escapeHtml(messageContent)}</blockquote>`
      : '';

    const cardHtml = `
🌐 <b>PORTAL APPLICATION LEAD</b>
🚀 <b>${title}</b> @ <b>${company}</b>
📍 ${location} | 🎯 ATS Score: <b>${atsScoreText}</b>${docsHtml}${linkedinHtml}${portalUrl}${subjectSnippet}${messageSnippet}

ℹ️ <i>No recruiter email found. Tailored CV and Cover Letter are generated. Tap buttons below to stream PDFs or open the portal.</i>
`.trim();

    return removeEmDashes(cardHtml);
  }

  // Email Application Lead Layout
  const subject = escapeHtml(data.emailSubject || `Application: ${data.jobTitle}`);
  const body = escapeHtml(data.emailBodyText || '');
  const recipients = data.recipientEmails.map((e) => `<code>${escapeHtml(e)}</code>`).join(', ');

  const cardHtml = `
🚀 <b>${title}</b> @ <b>${company}</b>
📍 ${location} | 🎯 ATS Score: <b>${atsScoreText}</b>${docsHtml}${linkedinHtml}

📬 <b>To:</b> ${recipients}
📝 <b>Subject:</b> <i>${subject}</i>

<blockquote>${body}</blockquote>
`.trim();

  return removeEmDashes(cardHtml);
}

/**
 * Generates the interactive inline keyboard matrix.
 * Adapts buttons for Email Leads vs. Portal Leads and includes CV + CL stream buttons + LinkedIn.
 */
export function generateInlineKeyboard(
  jobId: string,
  applicationLink?: string,
  isPortalLead: boolean = false,
  recruiterLinkedIn?: string,
  rowNumber?: number
): TelegramInlineKeyboardMarkup {
  const rowPrefix = rowNumber ? `r${rowNumber}:` : '';
  const maxKeyLen = 30 - rowPrefix.length;
  const shortKey = jobId.length > maxKeyLen ? jobId.slice(0, maxKeyLen) : jobId;
  const keyWithRow = `${rowPrefix}${shortKey}`;
  const keyboard: TelegramInlineButton[][] = [];

  // Row 1: Primary Action
  if (isPortalLead) {
    keyboard.push([
      {
        text: '✅ Applied on Portal',
        callback_data: `portal_applied:${keyWithRow}`,
      },
    ]);
  } else {
    keyboard.push([
      {
        text: '✅ Applied (Send Email)',
        callback_data: `approve:${keyWithRow}`,
      },
    ]);
  }

  // Row 2: Document Streaming (CV and Cover Letter)
  keyboard.push([
    {
      text: '📄 Send CV',
      callback_data: `send_cv:${keyWithRow}`,
    },
    {
      text: '📝 Send CL',
      callback_data: `send_cl:${keyWithRow}`,
    },
  ]);

  // Row 3: Skip / Not Relevant
  keyboard.push([
    {
      text: '⏭️ Skip',
      callback_data: `skip:${keyWithRow}`,
    },
    {
      text: '🚫 Not Relevant',
      callback_data: `not_relevant:${keyWithRow}`,
    },
  ]);

  // Row 4: Direct Careers Portal Link
  if (applicationLink && applicationLink.startsWith('http')) {
    keyboard.push([
      {
        text: '🔗 Open Careers Portal',
        url: applicationLink,
      },
    ]);
  }

  // Row 5: Recruiter / Company LinkedIn Profile Link
  if (recruiterLinkedIn && recruiterLinkedIn.startsWith('http')) {
    keyboard.push([
      {
        text: '💼 Recruiter / Company LinkedIn',
        url: recruiterLinkedIn,
      },
    ]);
  }

  return { inline_keyboard: keyboard };
}

/**
 * Sends a job review card to the Telegram cockpit channel/chat.
 */
export async function sendTelegramReviewCard(
  cardData: JobCardData,
  chatIdOverride?: string
): Promise<number> {
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || env.TELEGRAM_CHAT_ID;

  const isPortal = cardData.isPortalLead || cardData.recipientEmails.length === 0;
  const html = formatTelegramCardHtml(cardData);
  const replyMarkup = generateInlineKeyboard(
    cardData.jobId,
    cardData.applicationLink,
    isPortal,
    cardData.recruiterLinkedIn,
    cardData.rowNumber
  );

  await throttle('telegram');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`[TelegramAPI] Failed to send review card: ${data.description}`);
  }

  return data.result.message_id;
}

/**
 * Streams a PDF document to Telegram on-demand.
 */
export async function sendTelegramDocument(
  chatId: string,
  pdfBuffer: Buffer,
  fileName: string,
  caption?: string
): Promise<number> {
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;

  await throttle('telegram');

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(
    'document',
    new Blob([pdfBuffer as unknown as BlobPart], {
      type: 'application/pdf',
    }),
    fileName
  );

  if (caption) {
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
  }

  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(25000),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`[TelegramAPI] Failed to stream PDF document: ${data.description}`);
  }

  return data.result.message_id;
}

/**
 * Strips HTML tags and unescapes entities for safe plain-text fallback.
 */
export function stripHtmlTags(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Strips any previously appended status footer banner from card text to avoid duplication.
 */
export function stripExistingStatusBanner(text: string): string {
  return (text || '')
    .replace(/\n\n(?:✅|⏭️|🚫|⏳)\s*<b>STATUS:[\s\S]*$/i, '')
    .replace(/\n\n(?:✅|⏭️|🚫|⏳)\s*STATUS:[\s\S]*$/i, '')
    .trim();
}

/**
 * Converts Telegram Message text and its entity array back into valid, safe HTML.
 * Preserves bold, italic, code, blockquotes, and hyperlinked Drive URLs,
 * while safely escaping raw HTML special characters (&, <, >).
 */
export function telegramEntitiesToHtml(text?: string, entities?: any[]): string {
  if (!text) return '';
  if (!entities || !Array.isArray(entities) || entities.length === 0) {
    return escapeHtml(text);
  }

  // Map each character offset to opening and closing tags
  const openTags = new Map<number, string[]>();
  const closeTags = new Map<number, string[]>();

  for (const ent of entities) {
    const start = Math.max(0, Math.min(ent.offset || 0, text.length));
    const end = Math.max(start, Math.min(start + (ent.length || 0), text.length));
    let open = '';
    let close = '';

    switch (ent.type) {
      case 'bold':
        open = '<b>';
        close = '</b>';
        break;
      case 'italic':
        open = '<i>';
        close = '</i>';
        break;
      case 'underline':
        open = '<u>';
        close = '</u>';
        break;
      case 'strikethrough':
        open = '<s>';
        close = '</s>';
        break;
      case 'code':
        open = '<code>';
        close = '</code>';
        break;
      case 'pre':
        open = '<pre>';
        close = '</pre>';
        break;
      case 'blockquote':
        open = '<blockquote>';
        close = '</blockquote>';
        break;
      case 'expandable_blockquote':
        open = '<blockquote expandable>';
        close = '</blockquote>';
        break;
      case 'text_link':
        if (ent.url) {
          open = `<a href="${escapeHtml(ent.url)}">`;
          close = '</a>';
        }
        break;
      case 'spoiler':
        open = '<tg-spoiler>';
        close = '</tg-spoiler>';
        break;
      default:
        break;
    }

    if (open && close) {
      if (!openTags.has(start)) openTags.set(start, []);
      if (!closeTags.has(end)) closeTags.set(end, []);

      // If multiple entities start at the same offset, longer entities open first
      openTags.get(start)!.push(open);
      // Close tags: innermost entities close first
      closeTags.get(end)!.unshift(close);
    }
  }

  let result = '';
  for (let i = 0; i <= text.length; i++) {
    // 1. Process closing tags at offset i
    if (closeTags.has(i)) {
      for (const tag of closeTags.get(i)!) {
        result += tag;
      }
    }

    // 2. Process opening tags at offset i
    if (openTags.has(i)) {
      for (const tag of openTags.get(i)!) {
        result += tag;
      }
    }

    // 3. Escape and append character at offset i
    if (i < text.length) {
      const char = text[i];
      if (char === '&') result += '&amp;';
      else if (char === '<') result += '&lt;';
      else if (char === '>') result += '&gt;';
      else result += char;
    }
  }

  return result;
}

/**
 * Edits an existing message's text and inline keyboard in Telegram.
 * Implements multi-tier fail-safe resilience:
 * 1. Attempts HTML edit with rich formatting.
 * 2. If entity parse fails, falls back to plain-text message edit.
 * 3. If text edit fails, falls back to editMessageReplyMarkup to ensure buttons always update.
 */
export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  newText: string,
  newMarkup?: TelegramInlineKeyboardMarkup
): Promise<boolean> {
  if (!chatId || !messageId) {
    console.warn(`[TelegramBot] Cannot edit message: missing chatId (${chatId}) or messageId (${messageId})`);
    return false;
  }

  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;

  await throttle('telegram');

  const sanitizedText = removeEmDashes(newText);

  // Attempt 1: Edit text with HTML parse_mode
  try {
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: sanitizedText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: newMarkup,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data: any = await res.json();
    if (data.ok) {
      return true;
    }

    console.warn(`[TelegramBot] editMessageText (HTML) failed: ${data.description} (code ${data.error_code})`);

    // Attempt 2: If HTML parsing failed, strip HTML tags and retry as plain text
    const plainText = stripHtmlTags(sanitizedText);
    const retryRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: plainText,
        disable_web_page_preview: true,
        reply_markup: newMarkup,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const retryData: any = await retryRes.json();
    if (retryData.ok) {
      console.log(`[TelegramBot] editMessageText plain-text fallback succeeded for message ${messageId}.`);
      return true;
    }

    console.warn(`[TelegramBot] editMessageText (plain text) failed: ${retryData.description}`);
  } catch (err: any) {
    console.error(`[TelegramBot] Network error editing message text:`, err.message);
  }

  // Attempt 3: If text edit failed, at least update reply markup (buttons)
  if (newMarkup) {
    try {
      const markupUrl = `https://api.telegram.org/bot${token}/editMessageReplyMarkup`;
      const markupRes = await fetch(markupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: newMarkup,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const markupData: any = await markupRes.json();
      if (markupData.ok) {
        console.log(`[TelegramBot] editMessageReplyMarkup fallback succeeded for message ${messageId}.`);
        return true;
      }
      console.warn(`[TelegramBot] editMessageReplyMarkup failed: ${markupData.description}`);
    } catch (markupErr: any) {
      console.error(`[TelegramBot] Error updating reply markup fallback:`, markupErr.message);
    }
  }

  return false;
}

/**
 * Answers a Telegram callback query to dismiss loading state on button tap.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<boolean> {
  if (!callbackQueryId) return false;
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;

  try {
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Finds a matching job in Google Sheet rows using a strict 4-tier deterministic hierarchy.
 * Prevents ambiguous company-only matching when multiple positions exist for the same company.
 */
export function findMatchingSheetJob(
  sheetRows: any[],
  criteria: {
    explicitRowNumber?: number;
    rowNumber?: number;
    resolvedJobKey?: string;
    keyOrShort?: string;
    companyName?: string;
    jobTitle?: string;
  }
): any | undefined {
  const { explicitRowNumber, rowNumber, resolvedJobKey, keyOrShort, companyName, jobTitle } = criteria;

  return sheetRows.find((r) => {
    // Tier 1: Exact rowNumber match
    if (explicitRowNumber && r.rowNumber === explicitRowNumber) return true;
    if (rowNumber && r.rowNumber === rowNumber) return true;

    const k = generateJobKey(r.companyName, r.jobTitle);

    // Tier 2: Exact jobKey match
    if (resolvedJobKey && k === resolvedJobKey) return true;
    if (keyOrShort && k === keyOrShort) return true;

    // Tier 3: Strict prefix match (only if keyOrShort is specific enough, >= 15 chars)
    if (keyOrShort && keyOrShort.length >= 15 && k.startsWith(keyOrShort)) return true;

    // Tier 4: Exact normalized Company AND exact normalized Title match (BOTH must match!)
    if (companyName && jobTitle) {
      const cleanCardCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCardTitle = jobTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanRowCompany = r.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanRowTitle = r.jobTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        cleanRowCompany === cleanCardCompany &&
        (cleanRowTitle === cleanCardTitle || cleanRowTitle.includes(cleanCardTitle) || cleanCardTitle.includes(cleanRowTitle))
      ) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Handles incoming callback query interactions.
 */
export async function handleTelegramCallback(
  callbackQuery: any,
  options?: {
    getPdfBuffer?: (jobId: string) => Promise<Buffer>;
    getCoverLetterBuffer?: (jobId: string) => Promise<Buffer>;
  }
): Promise<void> {
  const queryId = callbackQuery.id;
  const data = String(callbackQuery.data || '');
  const message = callbackQuery.message;
  const chatId = String(message?.chat?.id || getEnv().TELEGRAM_CHAT_ID);
  const messageId = message?.message_id;

  const parts = data.split(':');
  const action = parts[0];
  let explicitRowNumber: number | undefined;
  let keyOrShort: string;

  if (parts.length >= 3 && /^r\d+$/i.test(parts[1])) {
    explicitRowNumber = parseInt(parts[1].slice(1), 10);
    keyOrShort = parts.slice(2).join(':');
  } else {
    keyOrShort = parts.slice(1).join(':');
  }

  let record = await getJobRecord(keyOrShort);
  let resolvedJobKey = record ? record.jobKey : keyOrShort;
  let rowNumber = explicitRowNumber || record?.rowNumber;
  let resumeDriveUrl = record?.resumeDriveUrl;
  let coverLetterDriveUrl = record?.coverLetterDriveUrl;
  let draftId = record?.draftId;
  let jobTitle = record?.jobTitle;
  let companyName = record?.companyName;
  const recipientEmails: string[] = record?.contactEmails ? [...record.contactEmails] : [];

  // Parse plain text message card as robust fallback (no HTML tag dependency)
  if (message?.text) {
    const rawText = message.text;

    // Parse recipient: "📬 To: careers@dicetek.net" or "To: careers@dicetek.net"
    const toMatch = rawText.match(/(?:📬\s*To:\s*|To:\s*)([^\n\r]+)/i);
    if (toMatch && toMatch[1]) {
      const parsedEmails = toMatch[1].split(',').map((e: string) => e.trim().replace(/[`<>]/g, ''));
      for (const email of parsedEmails) {
        if (email.includes('@') && !recipientEmails.includes(email)) {
          recipientEmails.push(email);
        }
      }
    }

    // Parse Title & Company: "🚀 Full Stack Developer @ Company"
    const titleMatch = rawText.match(/🚀\s*([^\n\r@]+)\s*@\s*([^\n\r📍|•]+)/i);
    if (titleMatch) {
      if (!jobTitle) jobTitle = titleMatch[1].trim();
      if (!companyName) companyName = titleMatch[2].trim();
    }
  }

  // Parse message entities for Drive URLs
  if (message?.entities) {
    for (const ent of message.entities) {
      if (ent.type === 'text_link' && ent.url && ent.url.includes('drive.google.com')) {
        const offset = ent.offset || 0;
        const length = ent.length || 0;
        const entityText = message.text?.slice(offset, offset + length) || '';
        if (entityText.toLowerCase().includes('cv') || entityText.toLowerCase().includes('resume')) {
          if (!resumeDriveUrl) resumeDriveUrl = ent.url;
        } else if (entityText.toLowerCase().includes('cover') || entityText.toLowerCase().includes('cl')) {
          if (!coverLetterDriveUrl) coverLetterDriveUrl = ent.url;
        }
      }
    }
  }

  // Cross-Platform Cloud Resolution: Resolve via Google Sheet (Deterministic 4-Tier Matcher)
  try {
    const sheetRows = await fetchLatestJobsFromSheet();
    const match = findMatchingSheetJob(sheetRows, {
      explicitRowNumber,
      rowNumber,
      resolvedJobKey,
      keyOrShort,
      companyName,
      jobTitle,
    });
    if (match) {
      resolvedJobKey = generateJobKey(match.companyName, match.jobTitle);
      rowNumber = rowNumber || match.rowNumber;
      resumeDriveUrl = resumeDriveUrl || match.cvLink;
      coverLetterDriveUrl = coverLetterDriveUrl || match.coverLetterLink;
      if (!jobTitle) jobTitle = match.jobTitle;
      if (!companyName) companyName = match.companyName;
      if (match.contactEmails && match.contactEmails.length > 0) {
        for (const e of match.contactEmails) {
          if (!recipientEmails.includes(e)) recipientEmails.push(e);
        }
      }
    }
  } catch (sheetErr: any) {
    console.warn('[TelegramBot] Sheet resolution note:', sheetErr.message);
  }

  if (action === 'approve') {
    try {
      await sendDraftForJob({
        draftId,
        toEmails: recipientEmails,
        jobTitle,
        companyName,
      });

      await approveJobApplication(resolvedJobKey);
      await clearActiveJobKey();
      if (rowNumber) {
        await updateSheetJobStatus(rowNumber, 'Applied (Email Sent)', {
          appliedAt: new Date().toISOString(),
          resumeDriveUrl,
          coverLetterDriveUrl,
        });
      }

      const rawBase = telegramEntitiesToHtml(message?.text, message?.entities);
      const cleanBase = stripExistingStatusBanner(rawBase);
      const updatedText = `${cleanBase}\n\n✅ <b>STATUS: EMAIL DISPATCHED VIA GMAIL API</b>\n⚡ <i>Tap [⚡ Next Lead] when you are ready for the next application.</i>`;
      await editTelegramMessage(chatId, messageId, updatedText, {
        inline_keyboard: [
          [{ text: '✅ Sent & Applied', callback_data: 'noop' }],
        ],
      });

      await answerCallbackQuery(queryId, '🚀 Application email dispatched!');
    } catch (err: any) {
      await answerCallbackQuery(queryId, `❌ Failed to dispatch email: ${err.message}`, true);
    }
  } else if (action === 'portal_applied') {
    try {
      await approveJobApplication(resolvedJobKey);
      await clearActiveJobKey();
      if (rowNumber) {
        await updateSheetJobStatus(rowNumber, 'Applied (Portal)', {
          appliedAt: new Date().toISOString(),
          resumeDriveUrl,
          coverLetterDriveUrl,
        });
      }

      const rawBase = telegramEntitiesToHtml(message?.text, message?.entities);
      const cleanBase = stripExistingStatusBanner(rawBase);
      const updatedText = `${cleanBase}\n\n✅ <b>STATUS: MARKED APPLIED ON CAREERS PORTAL</b>\n⚡ <i>Tap [⚡ Next Lead] when you are ready for the next application.</i>`;
      await editTelegramMessage(chatId, messageId, updatedText, {
        inline_keyboard: [
          [{ text: '✅ Applied on Portal', callback_data: 'noop' }],
        ],
      });

      await answerCallbackQuery(queryId, '✅ Marked applied on portal!');
    } catch (err: any) {
      await answerCallbackQuery(queryId, `❌ Error: ${err.message}`, true);
    }
  } else if (action === 'send_cv') {
    await answerCallbackQuery(queryId, '📄 Sending your tailored CV...').catch(() => {});
    try {
      let pdfBuffer: Buffer | undefined;

      // Extract metadata with multi-tier fallback (state record -> card HTML -> fallback)
      const cardMeta = extractJobMetadataFromCardText(message?.text);
      const companyName = record?.companyName || cardMeta.companyName || 'UaeTech';
      const jobTitle = record?.jobTitle || cardMeta.jobTitle || 'SoftwareEngineer';
      let fileName = generateDocumentFileName('CV', companyName, jobTitle);

      // 1. Check in-memory cache
      const cached = getCachedJobPdf(keyOrShort) || getCachedJobPdf(resolvedJobKey);
      if (cached) {
        pdfBuffer = cached.buffer;
        if (cached.fileName && !cached.fileName.includes('_Application.pdf')) {
          fileName = cached.fileName;
        }
      }

      // 2. Check local disk cache
      if (!pdfBuffer) {
        const baseCacheDir = process.env.VERCEL ? '/tmp' : process.cwd();
        const pdfCacheDir = path.resolve(baseCacheDir, '.cache', 'pdfs');
        const diskCandidates = [
          path.join(pdfCacheDir, `${resolvedJobKey}.pdf`),
          path.join(pdfCacheDir, `${keyOrShort}.pdf`),
        ];
        for (const diskPath of diskCandidates) {
          try {
            if (fsSync.existsSync(diskPath)) {
              pdfBuffer = await fs.readFile(diskPath);
              break;
            }
          } catch {}
        }
      }

      // 3. Check Google Drive via resolved resumeDriveUrl
      const cvTargetUrl = resumeDriveUrl || record?.resumeDriveUrl;
      if (!pdfBuffer && cvTargetUrl) {
        console.log(`[TelegramBot] Fetching CV PDF from Drive: ${cvTargetUrl}`);
        const downloaded = await downloadDrivePdfBuffer(cvTargetUrl);
        if (downloaded) {
          pdfBuffer = downloaded;
        }
      }

      // 3.5 Check Telegram review card message entities for embedded Drive links
      if (!pdfBuffer && message?.entities) {
        for (const ent of message.entities) {
          if (ent.type === 'text_link' && ent.url && ent.url.includes('drive.google.com')) {
            const downloaded = await downloadDrivePdfBuffer(ent.url);
            if (downloaded) {
              pdfBuffer = downloaded;
              break;
            }
          }
        }
      }

      // 3.6 Check Google Sheet directly for this job's CV Drive URL
      if (!pdfBuffer) {
        try {
          const sheetRows = await fetchLatestJobsFromSheet();
          const match = findMatchingSheetJob(sheetRows, {
            explicitRowNumber,
            rowNumber,
            resolvedJobKey,
            keyOrShort,
            companyName,
            jobTitle,
          });
          if (match?.cvLink) {
            const downloaded = await downloadDrivePdfBuffer(match.cvLink);
            if (downloaded) {
              pdfBuffer = downloaded;
            }
          }
        } catch {}
      }

      // 4. Check dynamic callback provider
      if (!pdfBuffer && options?.getPdfBuffer) {
        pdfBuffer = await options.getPdfBuffer(resolvedJobKey);
      }

      // 5. JIT synthesize fallback (only attempted if Chromium is available and not in Vercel)
      if (!pdfBuffer && !process.env.VERCEL) {
        try {
          const synthTitle = jobTitle || 'Software Engineer';
          const synthCompany = companyName || 'Company';
          console.log(`[TelegramBot] JIT synthesizing resume for on-demand send: ${synthTitle} @ ${synthCompany}`);
          const tailoredResume = await generateTailoredResumeData({
            jobTitle: synthTitle,
            jobDescription: `${synthTitle} at ${synthCompany}`,
            companyName: synthCompany,
          });
          pdfBuffer = await compileResumePdf(tailoredResume.resumeData);
          cacheJobPdf(resolvedJobKey, pdfBuffer, fileName);
        } catch (compileErr: any) {
          console.warn('[TelegramBot] JIT Chromium compilation unavailable:', compileErr.message);
        }
      }

      if (pdfBuffer) {
        const displayTitle = record?.jobTitle || cardMeta.jobTitle;
        const displayCompany = record?.companyName || cardMeta.companyName;
        const caption = (displayTitle && displayCompany)
          ? `📄 <b>Tailored Resume</b>: ${escapeHtml(displayTitle)} @ ${escapeHtml(displayCompany)}`
          : '📄 <b>Tailored Resume</b>';
        await sendTelegramDocument(chatId, pdfBuffer, fileName, caption);
      } else {
        await sendTelegramTextMessage(
          chatId,
          '⚠️ <b>PDF document not found in cache.</b> Please tap the 📁 <b>CV</b> link on the review card above to view or download directly from Google Drive.'
        );
      }
    } catch (err: any) {
      console.error('[TelegramBot] Error sending CV:', err);
      await sendTelegramTextMessage(chatId, `⚠️ <b>Could not deliver CV:</b> ${escapeHtml(err.message)}`);
    }
  } else if (action === 'send_cl') {
    await answerCallbackQuery(queryId, '📝 Sending your tailored Cover Letter...').catch(() => {});
    try {
      let clBuffer: Buffer | undefined;

      // Extract metadata with multi-tier fallback (state record -> card HTML -> fallback)
      const cardMeta = extractJobMetadataFromCardText(message?.text);
      const companyName = record?.companyName || cardMeta.companyName || 'UaeTech';
      const jobTitle = record?.jobTitle || cardMeta.jobTitle || 'SoftwareEngineer';
      let fileName = generateDocumentFileName('CoverLetter', companyName, jobTitle);

      // 1. Check in-memory cache
      const cached = getCachedJobCoverLetter(keyOrShort) || getCachedJobCoverLetter(resolvedJobKey);
      if (cached) {
        clBuffer = cached.buffer;
        if (cached.fileName && !cached.fileName.includes('_Application.pdf')) {
          fileName = cached.fileName;
        }
      }

      // 2. Check local disk cache
      if (!clBuffer) {
        const baseCacheDir = process.env.VERCEL ? '/tmp' : process.cwd();
        const clCacheDir = path.resolve(baseCacheDir, '.cache', 'cover-letters');
        const diskCandidates = [
          path.join(clCacheDir, `${resolvedJobKey}.pdf`),
          path.join(clCacheDir, `${keyOrShort}.pdf`),
        ];
        for (const diskPath of diskCandidates) {
          try {
            if (fsSync.existsSync(diskPath)) {
              clBuffer = await fs.readFile(diskPath);
              break;
            }
          } catch {}
        }
      }

      // 3. Check Google Drive via resolved coverLetterDriveUrl
      const clTargetUrl = coverLetterDriveUrl || record?.coverLetterDriveUrl;
      if (!clBuffer && clTargetUrl) {
        console.log(`[TelegramBot] Fetching Cover Letter PDF from Drive: ${clTargetUrl}`);
        const downloaded = await downloadDrivePdfBuffer(clTargetUrl);
        if (downloaded) {
          clBuffer = downloaded;
        }
      }

      // 3.5 Check Telegram review card message entities for embedded Cover Letter Drive links
      if (!clBuffer && message?.entities) {
        const driveLinks = message.entities.filter(
          (ent: any) => ent.type === 'text_link' && ent.url && ent.url.includes('drive.google.com')
        );
        // Cover letter is typically the 2nd Drive link on the review card
        const targetLink = driveLinks.length > 1 ? driveLinks[1] : driveLinks[0];
        if (targetLink?.url) {
          const downloaded = await downloadDrivePdfBuffer(targetLink.url);
          if (downloaded) {
            clBuffer = downloaded;
          }
        }
      }

      // 3.6 Check Google Sheet directly for this job's Cover Letter Drive URL
      if (!clBuffer) {
        try {
          const sheetRows = await fetchLatestJobsFromSheet();
          const match = findMatchingSheetJob(sheetRows, {
            explicitRowNumber,
            rowNumber,
            resolvedJobKey,
            keyOrShort,
            companyName,
            jobTitle,
          });
          if (match?.coverLetterLink) {
            const downloaded = await downloadDrivePdfBuffer(match.coverLetterLink);
            if (downloaded) {
              clBuffer = downloaded;
            }
          }
        } catch {}
      }

      // 4. Check dynamic callback provider
      if (!clBuffer && options?.getCoverLetterBuffer) {
        clBuffer = await options.getCoverLetterBuffer(resolvedJobKey);
      }

      // 5. JIT synthesize fallback (only attempted if Chromium is available and not in Vercel)
      if (!clBuffer && !process.env.VERCEL) {
        try {
          const synthTitle = jobTitle || 'Software Engineer';
          const synthCompany = companyName || 'Company';
          console.log(`[TelegramBot] JIT synthesizing cover letter for on-demand send: ${synthTitle} @ ${synthCompany}`);
          const tailoredCoverLetter = await generateTailoredCoverLetter({
            jobTitle: synthTitle,
            jobDescription: `${synthTitle} at ${synthCompany}`,
            companyName: synthCompany,
          });
          clBuffer = await compileCoverLetterPdf(tailoredCoverLetter);
          cacheJobCoverLetter(resolvedJobKey, clBuffer, fileName);
        } catch (compileErr: any) {
          console.warn('[TelegramBot] JIT Chromium compilation unavailable:', compileErr.message);
        }
      }

      if (clBuffer) {
        const displayTitle = record?.jobTitle || cardMeta.jobTitle;
        const displayCompany = record?.companyName || cardMeta.companyName;
        const caption = (displayTitle && displayCompany)
          ? `📝 <b>Tailored Cover Letter</b>: ${escapeHtml(displayTitle)} @ ${escapeHtml(displayCompany)}`
          : '📝 <b>Tailored Cover Letter</b>';
        await sendTelegramDocument(chatId, clBuffer, fileName, caption);
      } else {
        await sendTelegramTextMessage(
          chatId,
          '⚠️ <b>Cover letter not found in cache.</b> Please tap the 📝 <b>Cover Letter</b> link on the review card above to view or download directly from Google Drive.'
        );
      }
    } catch (err: any) {
      console.error('[TelegramBot] Error sending Cover Letter:', err);
      await sendTelegramTextMessage(chatId, `⚠️ <b>Could not deliver Cover Letter:</b> ${escapeHtml(err.message)}`);
    }
  } else if (action === 'skip') {
    await skipJobApplication(resolvedJobKey);
    await clearActiveJobKey();
    if (rowNumber) {
      await updateSheetJobStatus(rowNumber, 'Skipped by Candidate');
    }

    const rawBase = telegramEntitiesToHtml(message?.text, message?.entities);
    const cleanBase = stripExistingStatusBanner(rawBase);
    const updatedText = `${cleanBase}\n\n⏭️ <b>STATUS: SKIPPED BY CANDIDATE</b>\n⚡ <i>Tap [⚡ Next Lead] when you are ready for the next application.</i>`;
    await editTelegramMessage(chatId, messageId, updatedText, {
      inline_keyboard: [
        [{ text: '⏭️ Skipped', callback_data: 'noop' }],
      ],
    });
    await answerCallbackQuery(queryId, '⏭️ Job skipped. Tap [⚡ Next Lead] when ready.');
  } else if (action === 'not_relevant') {
    await markJobNotRelevant(resolvedJobKey);
    await clearActiveJobKey();
    if (rowNumber) {
      await updateSheetJobStatus(rowNumber, 'Not Relevant');
    }

    const rawBase = telegramEntitiesToHtml(message?.text, message?.entities);
    const cleanBase = stripExistingStatusBanner(rawBase);
    const updatedText = `${cleanBase}\n\n🚫 <b>STATUS: MARKED NOT RELEVANT</b>\n⚡ <i>Tap [⚡ Next Lead] when you are ready for the next application.</i>`;
    await editTelegramMessage(chatId, messageId, updatedText, {
      inline_keyboard: [
        [{ text: '🚫 Not Relevant', callback_data: 'noop' }],
      ],
    });
    await answerCallbackQuery(queryId, '🚫 Marked not relevant. Tap [⚡ Next Lead] when ready.');
  } else if (action === 'fetch_next') {
    await answerCallbackQuery(queryId, '⏳ Preparing next lead...');
    await handleFetchNext(chatId);
  } else {
    await answerCallbackQuery(queryId);
  }
}

/**
 * Triggers an on-demand JIT single-lead compilation run on GitHub Actions.
 * Free, lightweight (<300ms HTTP call) and runs Playwright Chromium in the cloud.
 */
export async function triggerGitHubActionsPipeline(options?: {
  inputs?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const env = getEnv();
    const token = env.GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) {
      const msg = 'No GITHUB_TOKEN configured in environment variables.';
      console.warn(`[TelegramBot] ${msg}`);
      return { success: false, error: msg };
    }

    const owner = (env as any).GITHUB_OWNER || process.env.GITHUB_OWNER || 'AmaanRizwan01';
    const repo = (env as any).GITHUB_REPO || process.env.GITHUB_REPO || 'pulsereach';

    const payload: { ref: string; inputs?: Record<string, any> } = { ref: 'main' };
    if (options?.inputs) {
      payload.inputs = options.inputs;
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/pulse-pipeline.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Pulsereach-Bot',
        },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok || res.status === 204) {
      console.log('🚀 [GitHubActions] JIT Workflow Dispatch triggered successfully!');
      return { success: true };
    } else {
      const errText = await res.text();
      const msg = `GitHub API HTTP ${res.status}: ${errText}`;
      console.warn(`[GitHubActions] Dispatch returned status ${res.status}: ${errText}`);
      return { success: false, error: msg };
    }
  } catch (err: any) {
    const msg = err.message || 'Unknown network error';
    console.warn(`[GitHubActions] Failed to dispatch workflow: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Sends a plain or HTML text message to a Telegram chat.
 */
export async function sendTelegramTextMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  await throttle('telegram');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: removeEmDashes(text),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  return data.ok === true;
}

/**
 * Synchronizes and cleans up registered bot commands with Telegram API.
 * Retains only essential commands (/status, /help) and purges obsolete clutter.
 */
export async function syncTelegramBotCommands(): Promise<boolean> {
  const token = getEnv().TELEGRAM_BOT_TOKEN;
  const commands = [
    { command: 'next', description: 'Fetch and prepare the next job lead' },
    { command: 'status', description: 'View cockpit status and backlog count' },
    { command: 'reset', description: 'Clear stuck locks and unlock queue' },
    { command: 'help', description: 'Pulsereach cockpit guide' },
  ];
  await throttle('telegram');
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err: any) {
    console.warn(`[TelegramBot] Failed to sync commands: ${err.message}`);
    return false;
  }
}

/**
 * Returns a persistent Telegram Reply Keyboard with quick-access buttons.
 * Pinned at the bottom of the chat for 1-tap operation.
 */
export function getReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '⚡ Next Lead' }, { text: '📊 Status' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Sends an HTML message to a chat with the persistent Reply Keyboard attached.
 */
export async function sendMessageWithKeyboard(chatId: string, text: string): Promise<boolean> {
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  await throttle('telegram');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: removeEmDashes(text),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: getReplyKeyboard(),
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  return data.ok === true;
}

/**
 * Fetches and processes the next (or specific) job lead on-demand.
 * Called by /next command, ⚡ Next Lead button tap, and fetch_next inline button.
 */
async function handleFetchNext(chatId: string, targetRowNumber?: number): Promise<void> {
  const label = targetRowNumber ? `Row ${targetRowNumber}` : 'next lead';

  // In Vercel serverless environment, dispatch GitHub Actions runner where Chromium is installed
  if (process.env.VERCEL) {
    await sendMessageWithKeyboard(
      chatId,
      `⏳ <b>Dispatching ${label} generation in the cloud...</b>\n⚡ <i>Running Playwright Chromium on GitHub Actions (~20-25s). Review card will arrive shortly!</i>`
    );
    const inputs: Record<string, any> = { force: 'true' };
    if (targetRowNumber) {
      inputs.target_row = String(targetRowNumber);
    }
    const result = await triggerGitHubActionsPipeline({ inputs });
    if (!result.success) {
      await sendMessageWithKeyboard(
        chatId,
        `⚠️ <b>GitHub Actions dispatch failed:</b>\n<code>${escapeHtml(result.error || 'Check GITHUB_TOKEN in Vercel settings')}</code>\n\n👉 <i>Make sure GITHUB_TOKEN has "Actions" read/write permissions in Vercel Environment Variables.</i>`
      );
    }
    return;
  }

  // Local / Dedicated server runtime
  await sendMessageWithKeyboard(chatId, `⏳ <b>Preparing ${label} from Google Sheets...</b>`);

  try {
    const result = await processSingleJobJustInTime({ targetRowNumber });

    if (result.processed) {
      // Review card was sent by the pipeline; nothing more to do
      return;
    }

    // Provide clear feedback for non-processing reasons
    if (result.reason === 'QUEUE_EMPTY') {
      await sendMessageWithKeyboard(chatId, '✨ <b>All leads processed!</b>\nAdd new rows to your Google Sheet and tap <b>[⚡ Next Lead]</b> again.');
    } else if (result.reason === 'ROW_NOT_FOUND') {
      await sendMessageWithKeyboard(chatId, `❌ <b>Row ${targetRowNumber} not found</b> in Google Sheets.`);
    } else if (result.reason === 'ROW_ALREADY_PROCESSED') {
      await sendMessageWithKeyboard(chatId, `⚠️ <b>Row ${targetRowNumber} was already processed.</b> Tap <b>[⚡ Next Lead]</b> to get the next unprocessed lead.`);
    } else if (result.error) {
      await sendMessageWithKeyboard(chatId, `❌ <b>Error:</b> ${escapeHtml(result.error)}`);
    } else {
      await sendMessageWithKeyboard(chatId, `ℹ️ Pipeline returned: ${result.reason || 'Unknown'}`);
    }
  } catch (err: any) {
    console.error('[TelegramBot] handleFetchNext error:', err);
    await sendMessageWithKeyboard(chatId, `❌ <b>Failed to fetch lead:</b> ${escapeHtml(err.message)}`);
  }
}

/**
 * Handles incoming direct text messages and slash commands in Telegram.
 */
export async function handleTelegramMessage(message: any): Promise<void> {
  if (!message || !message.text) return;
  const text = message.text.trim();
  const chatId = String(message.chat?.id || getEnv().TELEGRAM_CHAT_ID);

  // /next or /fetch — fetch next lead (optionally with row number)
  if (text.startsWith('/next') || text.startsWith('/fetch') || text === '⚡ Next Lead') {
    const parts = text.split(/\s+/);
    const rowArg = parts.length >= 2 ? parseInt(parts[1], 10) : undefined;
    const targetRow = rowArg && !isNaN(rowArg) ? rowArg : undefined;
    await handleFetchNext(chatId, targetRow);
    return;
  }

  // /reset or /unlock — clear stuck queue locks
  if (text.startsWith('/reset') || text.startsWith('/unlock')) {
    await clearAllLocks();
    await sendMessageWithKeyboard(chatId, '🔓 <b>Queue unlocked.</b> All locks and cooldowns cleared.\n⚡ Tap <b>[⚡ Next Lead]</b> to continue.');
    return;
  }

  // /status or 📊 Status — simplified cockpit status
  if (text.startsWith('/status') || text === '📊 Status') {
    const state = await loadState();
    const activeKey = await getActiveJobKey();
    const activeRecord = activeKey ? await getJobRecord(activeKey) : null;

    // Count unprocessed leads in Sheet
    let backlogCount = 0;
    try {
      const allRows = await fetchLatestJobsFromSheet();
      const unprocessed = await filterUnprocessedJobs(allRows);
      backlogCount = unprocessed.length;
    } catch {
      // Non-fatal; show 0
    }

    let statusText = `📊 <b>PULSEREACH COCKPIT STATUS</b>\n\n`;
    statusText += `🎯 <b>Active Lead:</b> ${activeRecord ? `<code>${activeRecord.jobTitle}</code> @ <b>${activeRecord.companyName}</b>` : '<i>None (Ready)</i>'}\n`;
    statusText += `📋 <b>Backlog:</b> ${backlogCount} unapplied lead${backlogCount !== 1 ? 's' : ''} in queue\n`;
    statusText += `📁 <b>Total Processed:</b> ${state.totalProcessedCount || 0} applications\n`;

    await sendMessageWithKeyboard(chatId, statusText);
    return;
  }

  // /start or /help
  if (text.startsWith('/start') || text.startsWith('/help') || text === '❓ Help') {
    const helpText = `👋 <b>Pulsereach Manual Cockpit</b>\n\n` +
      `Job outreach engine targeting the UAE market.\n\n` +
      `<b>Quick Actions:</b>\n` +
      `⚡ <b>[Next Lead]</b> or <code>/next</code>: Fetch the next job lead\n` +
      `<code>/next 14</code>: Fetch a specific row from your Sheet\n\n` +
      `<b>Review Card Buttons:</b>\n` +
      `• <b>[✅ Applied (Send Email)]</b>: Dispatch Gmail draft with A4 PDFs\n` +
      `• <b>[✅ Applied on Portal]</b>: Mark portal application complete\n` +
      `• <b>[📄 Send CV]</b> / <b>[📝 Send CL]</b>: Stream PDFs into chat\n` +
      `• <b>[⏭️ Skip]</b> / <b>[🚫 Not Relevant]</b>: Skip or filter lead\n\n` +
      `<b>Commands:</b>\n` +
      `<code>/next</code>: Fetch next lead (newest first)\n` +
      `<code>/next 14</code>: Fetch specific row\n` +
      `<code>/status</code>: View cockpit status\n` +
      `<code>/reset</code>: Clear stuck locks\n` +
      `<code>/help</code>: Show this guide`;
    await sendMessageWithKeyboard(chatId, helpText);
    return;
  }
}

// Backward-compatibility aliases
export { formatTelegramCardHtml as formatReviewCard, generateInlineKeyboard as buildReviewKeyboard };
