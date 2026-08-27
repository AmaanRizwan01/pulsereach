/**
 * Pulsereach — Master Job Pipeline & Just-In-Time (JIT) Orchestrator
 * Supports both batch execution and continuous single-job JIT processing
 * with dynamic 15-minute post-approval cooldowns, smart portal vs. email lead routing,
 * and live Google Sheets status write-backs.
 */

import fs from 'fs/promises';
import path from 'path';
import { fetchLatestJobsFromSheet, updateSheetJobStatus, SheetJobRow } from '../sheets/sheets-client.js';
import {
  generateJobKey,
  filterUnprocessedJobs,
  upsertJobRecord,
  updateJobStatus,
  ApplicationRecord,
  setActiveJobKey,
  clearActiveJobKey,
} from './state-tracker.js';
import { generateTailoredResumeData } from '../ai/resume-tailorer.js';
import { generateTailoredCoverLetter } from '../ai/cover-letter-generator.js';
import { generateTailoredOutreachEmail, generateLinkedInRecruiterPitch } from '../ai/email-generator.js';
import { compileResumePdf, compileCoverLetterPdf } from '../ai/pdf-compiler.js';
import { archiveApplicationPdfs } from '../drive/drive-service.js';
import { createMultiRecipientGmailDraft } from '../gmail/draft-service.js';
import {
  sendTelegramReviewCard,
  cacheJobPdf,
  cacheJobCoverLetter,
  JobCardData,
} from '../telegram/bot-service.js';
import { getRemainingDailyBudget } from '../anti-spam/deliverability-shield.js'; // Used only in batch pipeline
import { filterDeliverableEmails } from '../anti-spam/email-verifier.js';
import { generateDocumentFileName } from '../utils/file-naming.js';

export interface PipelineExecutionOptions {
  /** Maximum number of jobs to process in this run (defaults to remaining daily budget or 5) */
  maxJobs?: number;
  /** If true, runs generation and ATS scoring without writing to Gmail, Drive, or Telegram */
  dryRun?: boolean;
}

export interface PipelineJobResult {
  jobKey: string;
  jobTitle: string;
  companyName: string;
  success: boolean;
  atsScore?: number;
  draftId?: string;
  telegramMessageId?: number;
  resumeDriveUrl?: string;
  coverLetterDriveUrl?: string;
  error?: string;
}

export interface PipelineSummary {
  timestamp: string;
  totalFetched: number;
  unprocessedCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  remainingDailyBudget: number;
  results: PipelineJobResult[];
}

export interface JitProcessResult {
  processed: boolean;
  reason?: string;
  remainingMs?: number;
  nextEligibleAt?: string;
  activeJobKey?: string;
  jobKey?: string;
  jobTitle?: string;
  companyName?: string;
  atsScore?: number;
  draftId?: string;
  telegramMessageId?: number;
  error?: string;
}

/**
 * Parses diverse Google Sheet date strings into a reliable Unix epoch timestamp (ms).
 * Correctly parses 12-hour AM/PM formats (e.g. "2026-08-23 06:00 PM GST", "2026-08-23 12:00 PM GST"),
 * ISO strings, and standard date expressions.
 */
export function parseSheetDateTimestamp(rawDate: string | null | undefined): number {
  if (!rawDate || typeof rawDate !== 'string') return 0;
  const cleaned = rawDate.trim();
  if (!cleaned) return 0;

  // 1. Format: YYYY-MM-DD HH:MM (:SS)? (AM|PM)? (GST|UTC|...)?
  const ymdMatch = cleaned.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?(?:\s+([A-Za-z]+))?$/i
  );
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    let hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const ampm = ymdMatch[7] ? ymdMatch[7].toUpperCase() : null;

    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }

    const tz = ymdMatch[8] ? ymdMatch[8].toUpperCase() : '';
    if (tz === 'GST') {
      // GST is UTC+4: Date.UTC(year, month, day, hours - 4, minutes, seconds)
      return Date.UTC(year, month, day, hours - 4, minutes, seconds);
    }

    return new Date(year, month, day, hours, minutes, seconds).getTime();
  }

  // 2. Format: DD/MM/YYYY HH:MM (:SS)? (AM|PM)? (GST|UTC|...)?
  const dmyMatch = cleaned.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?(?:\s+([A-Za-z]+))?$/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const ampm = dmyMatch[7] ? dmyMatch[7].toUpperCase() : null;

    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }

    const tz = dmyMatch[8] ? dmyMatch[8].toUpperCase() : '';
    if (tz === 'GST') {
      return Date.UTC(year, month, day, hours - 4, minutes, seconds);
    }

    return new Date(year, month, day, hours, minutes, seconds).getTime();
  }

  // 3. Fallback: native Date.parse
  const parsed = Date.parse(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Sorts unapplied jobs using a Preemptive LIFO (Newest-First) Priority Queue.
 * Ordering rules:
 * 1. Newest parsed `dateFetched` timestamp descending (e.g. 06:00 PM GST > 04:00 PM GST > 12:00 PM GST).
 * 2. Higher `rowNumber` descending (most recently appended rows at the bottom of the sheet).
 */
export function sortJobsByPriority(jobs: SheetJobRow[]): SheetJobRow[] {
  return [...jobs].sort((a, b) => {
    const timeA = parseSheetDateTimestamp(a.dateFetched);
    const timeB = parseSheetDateTimestamp(b.dateFetched);
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return b.rowNumber - a.rowNumber;
  });
}

/**
 * Processes the single highest-priority unapplied job Just-In-Time (JIT).
 * In manual cockpit mode: no cooldowns, no lock gates, no daily budget blocks.
 * Optionally targets a specific Google Sheet row via `targetRowNumber`.
 */
export async function processSingleJobJustInTime(
  options: { dryRun?: boolean; force?: boolean; targetRowNumber?: number } = {}
): Promise<JitProcessResult> {
  // 1. Fetch fresh rows from Google Sheets
  console.log(`📥 [JIT Queue] Fetching live Google Sheet leads...`);
  const allRows = await fetchLatestJobsFromSheet();

  // 2. If targeting a specific row, find and validate it
  if (options.targetRowNumber) {
    const targetRow = allRows.find((r) => r.rowNumber === options.targetRowNumber);
    if (!targetRow) {
      console.log(`❌ [JIT Queue] Row ${options.targetRowNumber} not found in Google Sheets.`);
      return { processed: false, reason: 'ROW_NOT_FOUND' };
    }
    // Check if already processed
    if (targetRow.status) {
      const lower = targetRow.status.toLowerCase();
      if (lower.includes('applied') || lower.includes('skipped') || lower.includes('not relevant')) {
        console.log(`⚠️ [JIT Queue] Row ${options.targetRowNumber} already processed (Status: "${targetRow.status}").`);
        return { processed: false, reason: 'ROW_ALREADY_PROCESSED' };
      }
    }
    // Use this specific row
    const jobKey = generateJobKey(targetRow.companyName, targetRow.jobTitle);
    const deliverableEmails = await filterDeliverableEmails(targetRow.contactEmails);
    const hasValidEmail = deliverableEmails.length > 0;
    console.log(`\n🎯 [JIT Queue] Targeting Specific Row ${options.targetRowNumber}: "${targetRow.jobTitle}" at "${targetRow.companyName}".`);
    console.log(`   Application Type: ${hasValidEmail ? `Verified Email Outreach (${deliverableEmails.join(', ')})` : 'Direct Portal Application (No Deliverable Email)'}`);
    // Continue to generation with targetRow as the selected job
    return await _processSelectedJob(targetRow, jobKey, deliverableEmails, hasValidEmail, options);
  }

  // 3. Filter and sort unprocessed jobs (newest first)
  const unprocessed = await filterUnprocessedJobs(allRows);

  if (unprocessed.length === 0) {
    console.log(`🎉 [JIT Queue] All ${allRows.length} Google Sheet leads have been processed!`);
    return {
      processed: false,
      reason: 'QUEUE_EMPTY',
    };
  }

  // 4. Prioritize: newest leads first
  const sorted = sortJobsByPriority(unprocessed);
  const job = sorted[0];
  const jobKey = generateJobKey(job.companyName, job.jobTitle);

  // Real-time deliverability & DNS MX verification
  const deliverableEmails = await filterDeliverableEmails(job.contactEmails);
  const hasValidEmail = deliverableEmails.length > 0;

  console.log(`\n🎯 [JIT Queue] Selected Next Priority Lead: "${job.jobTitle}" at "${job.companyName}" (Row ${job.rowNumber}).`);
  console.log(`   Application Type: ${hasValidEmail ? `Verified Email Outreach (${deliverableEmails.join(', ')})` : 'Direct Portal Application (No Deliverable Email)'}`);
  console.log(`   (Remaining unapplied leads in backlog: ${sorted.length - 1})`);
  return await _processSelectedJob(job, jobKey, deliverableEmails, hasValidEmail, options);
}

/**
 * Internal helper: processes a single selected job through the full AI generation pipeline.
 * Shared by both the normal newest-first path and the targetRowNumber path.
 */
async function _processSelectedJob(
  job: SheetJobRow,
  jobKey: string,
  deliverableEmails: string[],
  hasValidEmail: boolean,
  options: { dryRun?: boolean } = {}
): Promise<JitProcessResult> {
  const now = new Date().toISOString();
  await upsertJobRecord({
    jobKey,
    rowNumber: job.rowNumber,
    jobTitle: job.jobTitle,
    companyName: job.companyName,
    location: job.location,
    status: 'PROCESSING',
    contactEmails: job.contactEmails,
    recruiterLinkedIn: job.recruiterLinkedIn,
    applicationLink: job.applicationLink,
    createdAt: now,
    updatedAt: now,
  });

  try {
    // 1. JIT AI Resume Synthesis
    console.log('  1️⃣ [JIT] Tailoring Resume via Gemini AI (ATS target >= 85%)...');
    const tailoredResume = await generateTailoredResumeData({
      jobTitle: job.jobTitle,
      jobDescription: `${job.domainCategory} role at ${job.companyName} in ${job.location}.\nOutreach Strategy: ${job.outreachStrategy}`,
      companyName: job.companyName,
      outreachStrategy: job.outreachStrategy,
      atsKeywordsAndPhrasing: job.atsKeywordsAndPhrasing,
    });
    const atsScore = tailoredResume.atsResult.overallAtsScore;
    console.log(`  ✅ [JIT] Resume tailored! ATS Score: ${atsScore}/100`);

    // 2. JIT AI Cover Letter Synthesis
    console.log('  2️⃣ [JIT] Generating Cover Letter via Gemini AI...');
    const tailoredCoverLetter = await generateTailoredCoverLetter({
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      jobDescription: `${job.domainCategory} role at ${job.companyName}.\n${job.outreachStrategy}`,
    });

    // 3. Compile A4 PDFs via Playwright
    console.log('  3️⃣ [JIT] Compiling A4 PDFs via Playwright...');
    const resumePdfBuffer = await compileResumePdf(tailoredResume.resumeData);
    const coverLetterPdfBuffer = await compileCoverLetterPdf(tailoredCoverLetter);

    const cvFileName = generateDocumentFileName('CV', job.companyName, job.jobTitle);
    const clFileName = generateDocumentFileName('CoverLetter', job.companyName, job.jobTitle);

    // Save to in-memory & local disk caches for persistent on-demand document streaming
    cacheJobPdf(jobKey, resumePdfBuffer, cvFileName);
    cacheJobCoverLetter(jobKey, coverLetterPdfBuffer, clFileName);

    try {
      const baseCacheDir = process.env.VERCEL ? '/tmp' : process.cwd();
      const pdfCacheDir = path.resolve(baseCacheDir, '.cache', 'pdfs');
      const clCacheDir = path.resolve(baseCacheDir, '.cache', 'cover-letters');
      await fs.mkdir(pdfCacheDir, { recursive: true });
      await fs.mkdir(clCacheDir, { recursive: true });
      await fs.writeFile(path.join(pdfCacheDir, `${jobKey}.pdf`), resumePdfBuffer);
      await fs.writeFile(path.join(clCacheDir, `${jobKey}.pdf`), coverLetterPdfBuffer);
      if (jobKey.length > 32) {
        await fs.writeFile(path.join(pdfCacheDir, `${jobKey.slice(0, 32)}.pdf`), resumePdfBuffer);
        await fs.writeFile(path.join(clCacheDir, `${jobKey.slice(0, 32)}.pdf`), coverLetterPdfBuffer);
      }
    } catch {
      // Non-fatal if disk cache write fails
    }

    if (options.dryRun) {
      console.log('  ℹ️ [DryRun] Skipping Drive, Gmail draft, and Telegram card.');
      return {
        processed: true,
        jobKey,
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        atsScore,
      };
    }

    // 4. Archive to Google Drive subfolders
    console.log('  4️⃣ [JIT] Archiving PDFs to Google Drive subfolders...');
    const driveUrls = await archiveApplicationPdfs({
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      resumePdfBuffer,
      coverLetterPdfBuffer,
    });

    let draftId: string | undefined;
    let emailSubject: string | undefined;
    let emailBodyText: string | undefined;
    let inMailSubject: string | undefined;
    let linkedInMessage: string | undefined;

    // 5. If Email Lead: Draft Cold Email & Create Gmail Draft; If Portal Lead: Generate Tailored LinkedIn InMail/DM
    if (hasValidEmail) {
      console.log('  5️⃣ [JIT] Drafting Outreach Email via Gemini AI...');
      const tailoredEmail = await generateTailoredOutreachEmail({
        companyName: job.companyName,
        jobTitle: job.jobTitle,
        jobDescription: `${job.domainCategory} role at ${job.companyName}.\n${job.outreachStrategy}`,
        recruiterName: deliverableEmails[0],
      });
      emailSubject = tailoredEmail.subject;
      emailBodyText = tailoredEmail.fullBodyText;

      console.log('  6️⃣ [JIT] Creating Gmail Draft in Account 2...');
      const draftResult = await createMultiRecipientGmailDraft({
        toEmails: deliverableEmails,
        subject: tailoredEmail.subject,
        bodyText: tailoredEmail.fullBodyText,
        resumePdfBuffer,
        resumeFileName: cvFileName,
        coverLetterPdfBuffer,
        coverLetterFileName: clFileName,
      });
      draftId = draftResult.draftId;
    } else {
      console.log('  5️⃣ [JIT] Portal Lead -> Generating Tailored LinkedIn Recruiter Message & InMail Subject...');
      const linkedInPitch = await generateLinkedInRecruiterPitch({
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        matchedSkills: tailoredResume.atsResult.matchedKeywords,
        outreachStrategy: job.outreachStrategy,
      });
      inMailSubject = linkedInPitch.subject;
      linkedInMessage = linkedInPitch.messageText;
    }

    // 6. Dispatch Telegram Review Card to Cockpit
    console.log('  7️⃣ [JIT] Dispatching Telegram Review Card to Cockpit...');
    const jobCard: JobCardData = {
      jobId: jobKey,
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      location: job.location,
      matchScore: atsScore,
      atsScore,
      domainCategory: job.domainCategory,
      recipientEmails: deliverableEmails,
      recruiterLinkedIn: job.recruiterLinkedIn,
      applicationLink: job.applicationLink,
      outreachStrategy: job.outreachStrategy,
      inMailSubject,
      linkedInMessage,
      emailSubject,
      emailBodyText,
      draftId,
      resumeDriveUrl: driveUrls.resumeDriveUrl,
      coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
      isPortalLead: !hasValidEmail,
      rowNumber: job.rowNumber,
    };

    const telegramMessageId = await sendTelegramReviewCard(jobCard);

    // Update state to DRAFT_CREATED or PORTAL_READY and set activeJobKey
    const stateStatus = hasValidEmail ? 'DRAFT_CREATED' : 'PENDING';
    await updateJobStatus(jobKey, stateStatus, {
      atsScore,
      matchScore: atsScore,
      selectedProjects: tailoredResume.resumeData.projects.map((p: any) => p.name),
      draftId,
      telegramMessageId,
      resumeDriveUrl: driveUrls.resumeDriveUrl,
      coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
      recruiterLinkedIn: job.recruiterLinkedIn,
      applicationLink: job.applicationLink,
    });
    await setActiveJobKey(jobKey);

    // Update Google Sheet Row Status
    console.log(`  8️⃣ [JIT] Updating Google Sheet Row ${job.rowNumber} status...`);
    const sheetStatus = hasValidEmail ? 'Draft Created (Pending Review)' : 'Portal Lead (Ready to Apply)';
    await updateSheetJobStatus(job.rowNumber, sheetStatus, {
      appliedAt: new Date().toISOString(),
      resumeDriveUrl: driveUrls.resumeDriveUrl,
      coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
    });

    console.log(`✨ [JIT Queue] Lead "${job.jobTitle}" at "${job.companyName}" successfully prepared and delivered to Telegram cockpit!`);

    return {
      processed: true,
      jobKey,
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      atsScore,
      draftId,
      telegramMessageId,
    };
  } catch (err: any) {
    console.error(`❌ [JIT Queue] Error processing "${job.jobTitle}" at "${job.companyName}":`, err.message);
    await updateJobStatus(jobKey, 'FAILED', { lastError: err.message });
    await updateSheetJobStatus(job.rowNumber, 'Failed to Process', { error: err.message });
    await clearActiveJobKey();
    return {
      processed: false,
      jobKey,
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      error: err.message,
    };
  }
}

/**
 * Runs the end-to-end master job batch pipeline.
 */
export async function runJobBatchPipeline(
  options: PipelineExecutionOptions = {}
): Promise<PipelineSummary> {
  const startTime = new Date().toISOString();
  console.log(`\n🚀 [Pipeline] Starting Pulsereach Master Batch Pipeline at ${startTime}...`);

  const remainingBudget = getRemainingDailyBudget();
  const maxToProcess = Math.min(options.maxJobs || 5, Math.max(0, remainingBudget));

  console.log(`📊 [Pipeline] Remaining daily send budget: ${remainingBudget}. Processing up to ${maxToProcess} jobs.`);

  // 1. Fetch rows from Google Sheet
  console.log('📥 [Pipeline] Ingesting jobs from Google Sheets API...');
  const allRows = await fetchLatestJobsFromSheet();
  console.log(`✅ [Pipeline] Ingested ${allRows.length} total rows from spreadsheet.`);

  // 2. Filter unprocessed jobs via deduplication store
  const unprocessedJobs = await filterUnprocessedJobs(allRows);
  console.log(`🔍 [Pipeline] Found ${unprocessedJobs.length} unprocessed jobs awaiting action.`);

  if (unprocessedJobs.length === 0 || maxToProcess === 0) {
    console.log('✨ [Pipeline] No pending unprocessed jobs to execute. Pipeline finished.');
    return {
      timestamp: startTime,
      totalFetched: allRows.length,
      unprocessedCount: 0,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      remainingDailyBudget: remainingBudget,
      results: [],
    };
  }

  const sortedJobs = sortJobsByPriority(unprocessedJobs);
  const jobsToProcess = sortedJobs.slice(0, maxToProcess);
  const results: PipelineJobResult[] = [];

  for (const [index, job] of jobsToProcess.entries()) {
    const jobKey = generateJobKey(job.companyName, job.jobTitle);
    console.log(`\n▶️ [Pipeline] Processing Job ${index + 1}/${jobsToProcess.length}: "${job.jobTitle}" at "${job.companyName}"...`);

    const now = new Date().toISOString();
    const initialRecord: ApplicationRecord = {
      jobKey,
      rowNumber: job.rowNumber,
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      location: job.location,
      status: 'PROCESSING',
      contactEmails: job.contactEmails,
      recruiterLinkedIn: job.recruiterLinkedIn,
      applicationLink: job.applicationLink,
      createdAt: now,
      updatedAt: now,
    };

    await upsertJobRecord(initialRecord);

    try {
      // Step A: Dynamic Resume Tailoring & ATS Scoring via Gemini AI
      console.log('  1️⃣ Dynamically tailoring Resume via Gemini AI...');
      const tailoredResume = await generateTailoredResumeData({
        jobTitle: job.jobTitle,
        jobDescription: `${job.domainCategory} role at ${job.companyName} in ${job.location}.\nOutreach Strategy: ${job.outreachStrategy}`,
        companyName: job.companyName,
        outreachStrategy: job.outreachStrategy,
        atsKeywordsAndPhrasing: job.atsKeywordsAndPhrasing,
      });

      const atsScore = tailoredResume.atsResult.overallAtsScore;
      console.log(`  ✅ Tailored Resume finalized! ATS Score: ${atsScore}/100 (Grade: ${tailoredResume.atsResult.ratingGrade})`);

      // Step B: Dynamic Cover Letter Generation via Gemini AI
      console.log('  2️⃣ Dynamically generating 4-paragraph Cover Letter via Gemini AI...');
      const tailoredCoverLetter = await generateTailoredCoverLetter({
        companyName: job.companyName,
        jobTitle: job.jobTitle,
        jobDescription: `${job.domainCategory} role at ${job.companyName}.\n${job.outreachStrategy}`,
      });

      // Step C: Compile Playwright Single-Page A4 PDFs
      console.log('  3️⃣ Compiling single-page A4 PDFs via Playwright Chromium...');
      const resumePdfBuffer = await compileResumePdf(tailoredResume.resumeData);
      const coverLetterPdfBuffer = await compileCoverLetterPdf(tailoredCoverLetter);

      const cvFileName = generateDocumentFileName('CV', job.companyName, job.jobTitle);
      const clFileName = generateDocumentFileName('CoverLetter', job.companyName, job.jobTitle);

      cacheJobPdf(jobKey, resumePdfBuffer, cvFileName);
      cacheJobCoverLetter(jobKey, coverLetterPdfBuffer, clFileName);

      try {
        const baseCacheDir = process.env.VERCEL ? '/tmp' : process.cwd();
        const pdfCacheDir = path.resolve(baseCacheDir, '.cache', 'pdfs');
        const clCacheDir = path.resolve(baseCacheDir, '.cache', 'cover-letters');
        await fs.mkdir(pdfCacheDir, { recursive: true });
        await fs.mkdir(clCacheDir, { recursive: true });
        await fs.writeFile(path.join(pdfCacheDir, `${jobKey}.pdf`), resumePdfBuffer);
        await fs.writeFile(path.join(clCacheDir, `${jobKey}.pdf`), coverLetterPdfBuffer);
      } catch {}

      if (options.dryRun) {
        console.log('  ℹ️ [DryRun] Skipping Drive archiving, Gmail draft, and Telegram dispatch.');
        results.push({
          jobKey,
          jobTitle: job.jobTitle,
          companyName: job.companyName,
          success: true,
          atsScore,
        });
        continue;
      }

      // Step D: Archive PDFs to Google Drive Subfolders
      console.log('  4️⃣ Archiving PDFs to Google Drive subfolders...');
      const driveUrls = await archiveApplicationPdfs({
        companyName: job.companyName,
        jobTitle: job.jobTitle,
        resumePdfBuffer,
        coverLetterPdfBuffer,
      });

      let draftId: string | undefined;
      let emailSubject: string | undefined;
      let emailBodyText: string | undefined;
      let inMailSubject: string | undefined;
      let linkedInMessage: string | undefined;

      // Real-time deliverability & DNS MX verification
      const deliverableEmails = await filterDeliverableEmails(job.contactEmails);
      const hasValidEmail = deliverableEmails.length > 0;

      // Step E: Create Gmail Draft ONLY if valid contact emails exist; else generate tailored LinkedIn InMail/DM
      if (hasValidEmail) {
        console.log('  5️⃣ Dynamically drafting Cold Outreach Email via Gemini AI...');
        const tailoredEmail = await generateTailoredOutreachEmail({
          companyName: job.companyName,
          jobTitle: job.jobTitle,
          jobDescription: `${job.domainCategory} role at ${job.companyName}.\n${job.outreachStrategy}`,
          recruiterName: deliverableEmails[0],
        });
        emailSubject = tailoredEmail.subject;
        emailBodyText = tailoredEmail.fullBodyText;

        console.log('  6️⃣ Creating Persistent Gmail Draft in Account 2...');
        const draftResult = await createMultiRecipientGmailDraft({
          toEmails: deliverableEmails,
          subject: tailoredEmail.subject,
          bodyText: tailoredEmail.fullBodyText,
          resumePdfBuffer,
          resumeFileName: cvFileName,
          coverLetterPdfBuffer,
          coverLetterFileName: clFileName,
        });
        draftId = draftResult.draftId;
      } else {
        console.log('  5️⃣ [Pipeline] Portal lead -> Generating Tailored LinkedIn Recruiter Message & InMail Subject...');
        const linkedInPitch = await generateLinkedInRecruiterPitch({
          jobTitle: job.jobTitle,
          companyName: job.companyName,
          matchedSkills: tailoredResume.atsResult.matchedKeywords,
          outreachStrategy: job.outreachStrategy,
        });
        inMailSubject = linkedInPitch.subject;
        linkedInMessage = linkedInPitch.messageText;
      }

      // Step F: Send Review Card to Telegram Cockpit
      console.log('  7️⃣ Sending Review Card to Telegram cockpit...');
      const jobCard: JobCardData = {
        jobId: jobKey,
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        location: job.location,
        matchScore: atsScore,
        atsScore,
        domainCategory: job.domainCategory,
        recipientEmails: deliverableEmails,
        recruiterLinkedIn: job.recruiterLinkedIn,
        applicationLink: job.applicationLink,
        outreachStrategy: job.outreachStrategy,
        inMailSubject,
        linkedInMessage,
        emailSubject,
        emailBodyText,
        draftId,
        resumeDriveUrl: driveUrls.resumeDriveUrl,
        coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
        isPortalLead: !hasValidEmail,
        rowNumber: job.rowNumber,
      };

      const telegramMessageId = await sendTelegramReviewCard(jobCard);

      // Step G: Update State Tracker
      const stateStatus = hasValidEmail ? 'DRAFT_CREATED' : 'PENDING';
      await updateJobStatus(jobKey, stateStatus, {
        atsScore,
        matchScore: atsScore,
        selectedProjects: tailoredResume.resumeData.projects.map((p: any) => p.name),
        draftId,
        telegramMessageId,
        resumeDriveUrl: driveUrls.resumeDriveUrl,
        coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
        recruiterLinkedIn: job.recruiterLinkedIn,
        applicationLink: job.applicationLink,
      });

      // Step H: Update Google Sheet Row Status
      console.log(`  8️⃣ Updating Google Sheet Row ${job.rowNumber} status...`);
      const sheetStatus = hasValidEmail ? 'Draft Created (Pending Review)' : 'Portal Lead (Ready to Apply)';
      await updateSheetJobStatus(job.rowNumber, sheetStatus, {
        appliedAt: new Date().toISOString(),
        resumeDriveUrl: driveUrls.resumeDriveUrl,
        coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
      });

      results.push({
        jobKey,
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        success: true,
        atsScore,
        draftId,
        telegramMessageId,
        resumeDriveUrl: driveUrls.resumeDriveUrl,
        coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
      });
    } catch (err: any) {
      console.error(`  ❌ [Pipeline] Failed to process "${job.jobTitle}" at "${job.companyName}":`, err.message);
      await updateJobStatus(jobKey, 'FAILED', { lastError: err.message });
      await updateSheetJobStatus(job.rowNumber, 'Failed to Process', { error: err.message });
      results.push({
        jobKey,
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        success: false,
        error: err.message,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  const remainingBacklog = unprocessedJobs.length - results.length;
  if (remainingBacklog > 0) {
    console.log(`\n📋 [Backlog Status] ⚠️ ${remainingBacklog} unapplied job(s) remain queued in Google Sheets.`);
  } else {
    console.log(`\n🎉 [Backlog Status] All jobs in Google Sheets have been fully processed!`);
  }

  console.log(`\n🏁 [Pipeline] Batch Finished! Processed: ${results.length}, Success: ${successCount}, Failed: ${failedCount}`);

  return {
    timestamp: startTime,
    totalFetched: allRows.length,
    unprocessedCount: unprocessedJobs.length,
    processedCount: results.length,
    successCount,
    failedCount,
    remainingDailyBudget: getRemainingDailyBudget(),
    results,
  };
}

if (process.argv[1]?.endsWith('pipeline.ts') || process.argv[1]?.endsWith('pipeline.js')) {
  const isSingle = process.argv.includes('--single') || process.argv.includes('--next');
  if (isSingle) {
    processSingleJobJustInTime()
      .then((result) => {
        console.log('\n🎯 JIT Lead Execution Result:\n', JSON.stringify(result, null, 2));
        process.exit(0);
      })
      .catch((err) => {
        console.error('Fatal Pipeline Error:', err);
        process.exit(1);
      });
  } else {
    runJobBatchPipeline()
      .then((summary) => {
        console.log('\n📊 Pipeline Execution Summary:\n', JSON.stringify(summary, null, 2));
        process.exit(0);
      })
      .catch((err) => {
        console.error('Fatal Pipeline Error:', err);
        process.exit(1);
      });
  }
}
