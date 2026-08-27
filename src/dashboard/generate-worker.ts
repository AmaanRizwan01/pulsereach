/**
 * Pulsereach — Dashboard Generation Worker
 * Executed by GitHub Actions to generate tailored CV, Cover Letter, and Outreach Email.
 * Calls ALL existing generators exactly as-is with zero modifications.
 * Uploads results (PDFs + metadata JSON) to Google Drive for the frontend to poll.
 */

import { generateTailoredResumeData } from '../ai/resume-tailorer.js';
import { generateTailoredCoverLetter } from '../ai/cover-letter-generator.js';
import { generateTailoredOutreachEmail } from '../ai/email-generator.js';
import { compileResumePdf, compileCoverLetterPdf } from '../ai/pdf-compiler.js';
import {
  archiveApplicationPdfs,
  getOrCreateApplicationsRootFolder,
} from '../drive/drive-service.js';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { getEnv } from '../config/env.js';
import { throttle } from '../rate-limiter/token-bucket.js';

/** Parsed inputs for the dashboard worker. */
interface DashboardWorkerArgs {
  jobId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

/**
 * Resolves inputs from environment variables (GitHub Actions mode) or CLI arguments (local testing).
 */
function parseWorkerInputs(): DashboardWorkerArgs {
  // 1. Check environment variables first (GitHub Actions standard)
  const envJobId = process.env.INPUT_JOB_ID;
  const envJobTitle = process.env.INPUT_JOB_TITLE;
  const envCompanyName = process.env.INPUT_COMPANY_NAME;
  const envJobDescription = process.env.INPUT_JOB_DESCRIPTION;

  if (envJobId && envJobTitle && envCompanyName && envJobDescription) {
    return {
      jobId: envJobId.trim(),
      jobTitle: envJobTitle.trim(),
      companyName: envCompanyName.trim(),
      jobDescription: envJobDescription.trim(),
    };
  }

  // 2. Fallback: Parse CLI arguments for local terminal testing
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z-]+)=([\s\S]+)$/i);
    if (match) {
      const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = match[2];
    }
  }

  const jobId = args.jobId;
  const jobTitle = args.jobTitle;
  const companyName = args.companyName;
  const jobDescription = args.jobDescription;

  if (!jobId || !jobTitle || !companyName || !jobDescription) {
    console.error('❌ [Dashboard Worker] Missing required inputs.');
    console.error('   Expected either environment variables (INPUT_JOB_ID, INPUT_JOB_TITLE, etc.)');
    console.error('   or CLI arguments (--job-id, --job-title, --company-name, --job-description)');
    process.exit(1);
  }

  return { jobId, jobTitle, companyName, jobDescription };
}

/**
 * Uploads a JSON results file to the "Dashboard Results" subfolder on Google Drive.
 * Uses the existing Google Drive OAuth2 credentials and folder structure.
 */
async function uploadResultsJsonToDrive(
  jobId: string,
  results: Record<string, unknown>
): Promise<string> {
  await throttle('sheets');
  const env = getEnv();

  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({
    refresh_token: env.GOOGLE_STORAGE_REFRESH_TOKEN,
  });
  const drive = google.drive({ version: 'v3', auth: auth as any });

  // Get or create the "Dashboard Results" subfolder under "Pulsereach Applications"
  const rootFolderId = await getOrCreateApplicationsRootFolder();

  await throttle('sheets');
  let dashboardFolderId: string;
  const folderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = 'Dashboard Results' and '${rootFolderId}' in parents and trashed = false`;
  const folderRes = await drive.files.list({
    q: folderQuery,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (folderRes.data.files && folderRes.data.files.length > 0 && folderRes.data.files[0].id) {
    dashboardFolderId = folderRes.data.files[0].id;
  } else {
    const createRes = await drive.files.create({
      requestBody: {
        name: 'Dashboard Results',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
      fields: 'id',
    });
    dashboardFolderId = createRes.data.id || '';
  }

  // Upload the results JSON file
  const fileName = `results-${jobId}.json`;
  const jsonBuffer = Buffer.from(JSON.stringify(results, null, 2), 'utf-8');
  const stream = new Readable();
  stream.push(jsonBuffer);
  stream.push(null);

  await throttle('sheets');
  const fileRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [dashboardFolderId],
    },
    media: {
      mimeType: 'application/json',
      body: stream,
    },
    fields: 'id',
  });

  const fileId = fileRes.data.id || '';

  // Make publicly readable so the Vercel status endpoint can find it
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch {
    // Non-fatal
  }

  console.log(`✅ [Dashboard Worker] Results JSON uploaded to Drive: ${fileName} (${fileId})`);
  return fileId;
}

/**
 * Main dashboard generation pipeline.
 * Calls existing generators with zero modifications.
 */
async function runDashboardGeneration(): Promise<void> {
  const { jobId, jobTitle, companyName, jobDescription } = parseWorkerInputs();
  const startTime = Date.now();

  console.log(`\n⚡ [Dashboard Worker] Starting generation for job: "${jobId}"`);
  console.log(`   Title: ${jobTitle}`);
  console.log(`   Company: ${companyName}`);
  console.log(`   JD Length: ${jobDescription.length} chars`);

  try {
    // Step 1: Tailor Resume via existing generateTailoredResumeData() — UNTOUCHED
    console.log('\n1️⃣  [Dashboard] Tailoring Resume via Gemini AI...');
    const tailoredResume = await generateTailoredResumeData({
      jobTitle,
      jobDescription,
      companyName,
    });
    const atsScore = tailoredResume.atsResult.overallAtsScore;
    console.log(`   ✅ Resume tailored! ATS Score: ${atsScore}/100 (Grade: ${tailoredResume.atsResult.ratingGrade})`);

    // Step 2: Generate Cover Letter via existing generateTailoredCoverLetter() — UNTOUCHED
    console.log('\n2️⃣  [Dashboard] Generating Cover Letter via Gemini AI...');
    const coverLetter = await generateTailoredCoverLetter({
      jobTitle,
      companyName,
      jobDescription,
    });
    console.log(`   ✅ Cover Letter generated! Word count: ${coverLetter.wordCount}`);

    // Step 3: Generate Outreach Email via existing generateTailoredOutreachEmail() — UNTOUCHED
    console.log('\n3️⃣  [Dashboard] Drafting Outreach Email via Gemini AI...');
    const outreachEmail = await generateTailoredOutreachEmail({
      jobTitle,
      companyName,
      jobDescription,
    });
    console.log(`   ✅ Outreach Email drafted! Subject: "${outreachEmail.subject}"`);

    // Step 4: Compile PDFs via existing Playwright compiler — UNTOUCHED
    console.log('\n4️⃣  [Dashboard] Compiling A4 PDFs via Playwright...');
    const resumePdfBuffer = await compileResumePdf(tailoredResume.resumeData);
    const coverLetterPdfBuffer = await compileCoverLetterPdf(coverLetter);
    console.log(`   ✅ PDFs compiled! Resume: ${Math.round(resumePdfBuffer.length / 1024)}KB, CL: ${Math.round(coverLetterPdfBuffer.length / 1024)}KB`);

    // Step 5: Archive PDFs to Google Drive via existing archiveApplicationPdfs() — UNTOUCHED
    console.log('\n5️⃣  [Dashboard] Archiving PDFs to Google Drive...');
    const driveUrls = await archiveApplicationPdfs({
      companyName,
      jobTitle,
      resumePdfBuffer,
      coverLetterPdfBuffer,
    });
    console.log(`   ✅ Resume: ${driveUrls.resumeDriveUrl}`);
    console.log(`   ✅ Cover Letter: ${driveUrls.coverLetterDriveUrl || 'N/A'}`);

    // Step 6: Upload results JSON to Google Drive
    const elapsed = Date.now() - startTime;
    console.log('\n6️⃣  [Dashboard] Uploading results metadata to Google Drive...');

    const results = {
      status: 'COMPLETE',
      jobId,
      jobTitle,
      companyName,
      // ATS Score & Breakdown
      atsScore: tailoredResume.atsResult.overallAtsScore,
      atsGrade: tailoredResume.atsResult.ratingGrade,
      atsPassProbability: tailoredResume.atsResult.passProbability,
      keywordMatchRate: tailoredResume.atsResult.keywordMatchRate,
      matchedKeywords: tailoredResume.atsResult.matchedKeywords,
      missingKeywords: tailoredResume.atsResult.missingKeywords,
      summaryFitAnalysis: tailoredResume.atsResult.summaryFitAnalysis,
      bulletImpactScore: tailoredResume.atsResult.bulletImpactScore,
      recommendations: tailoredResume.atsResult.recommendations,
      projectCount: tailoredResume.projectCount,
      // Cover Letter
      coverLetterWordCount: coverLetter.wordCount,
      // Outreach Email
      emailSubject: outreachEmail.subject,
      emailBody: outreachEmail.fullBodyText,
      emailWordCount: outreachEmail.wordCount,
      // Google Drive PDF URLs
      resumeDriveUrl: driveUrls.resumeDriveUrl,
      coverLetterDriveUrl: driveUrls.coverLetterDriveUrl || '',
      // Metadata
      generationTimeMs: elapsed,
      generatedAt: new Date().toISOString(),
    };

    await uploadResultsJsonToDrive(jobId, results);

    console.log(`\n🎉 [Dashboard Worker] Generation complete in ${(elapsed / 1000).toFixed(1)}s!`);
    console.log(`   ATS Score: ${atsScore}/100 (${tailoredResume.atsResult.ratingGrade})`);
    console.log(`   Resume: ${driveUrls.resumeDriveUrl}`);
    console.log(`   Cover Letter: ${driveUrls.coverLetterDriveUrl || 'N/A'}`);
    console.log(`   Email Subject: "${outreachEmail.subject}"`);
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`\n❌ [Dashboard Worker] Generation failed after ${(elapsed / 1000).toFixed(1)}s:`, err.message);

    // Upload error results so the frontend knows it failed
    try {
      await uploadResultsJsonToDrive(jobId, {
        status: 'FAILED',
        jobId,
        jobTitle,
        companyName,
        error: err.message,
        generationTimeMs: elapsed,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      console.error('   ⚠️ Could not upload failure results to Drive.');
    }

    process.exit(1);
  }
}

// Execute
runDashboardGeneration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Dashboard Worker Error:', err);
    process.exit(1);
  });
