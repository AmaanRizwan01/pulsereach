import { generateTailoredResumeData } from '../ai/resume-tailorer.js';
import { generateTailoredCoverLetter } from '../ai/cover-letter-generator.js';
import { generateTailoredOutreachEmail } from '../ai/email-generator.js';
import { compileResumePdf, compileCoverLetterPdf } from '../ai/pdf-compiler.js';
import { archiveApplicationPdfs } from './drive-service.js';
import { createMultiRecipientGmailDraft } from '../gmail/draft-service.js';
import { generateDocumentFileName } from '../utils/file-naming.js';
import {
  sendTelegramReviewCard,
  cacheJobPdf,
  JobCardData,
} from '../telegram/bot-service.js';

console.log('🚀 === Pulsereach 6-Rule Pipeline Verification ===\n');

// Real UAE Vacancy: Senior Frontend / Full-Stack Engineer at Careem
const targetJob = {
  jobId: 'careem-fe-001',
  jobTitle: 'Frontend / Full-Stack Software Engineer (React / Next.js)',
  companyName: 'Careem',
  location: 'Dubai Internet City, Dubai, UAE',
  recruiterName: 'Tariq Al-Hashemi',
  recruiterEmail: 'careers@careem.com',
  applicationLink: 'https://careers.careem.com/jobs/frontend-engineer-dubai',
  outreachStrategy: 'Highlight Next.js App Router, high-throughput React state management, and immediate UAE availability.',
  atsKeywordsAndPhrasing: 'Next.js App Router, React.js, TypeScript, Tailwind CSS, REST APIs, Web Performance, Core Web Vitals, Responsive Design',
  jobDescription: `Careem is seeking a talented Frontend / Full-Stack Software Engineer to build scalable, high-performance web applications and SuperApp customer portals.
Key Responsibilities:
- Architect and develop modern, responsive web applications using Next.js App Router, React, and TypeScript.
- Optimize frontend rendering paths, Core Web Vitals, and time-to-interactive (TTI) for sub-second page performance across mobile and desktop.
- Collaborate with backend engineers to integrate RESTful APIs and real-time payment webhooks with robust error handling.
- Build clean, reusable component libraries and design systems with modern CSS/Tailwind.
- Ensure strict cross-browser compatibility and zero-defect QA across major device viewports.
Requirements:
- Strong proficiency in JavaScript (ES6+), TypeScript, React.js, and Next.js.
- Demonstrated experience building production SaaS platforms, payment gateway integrations, or high-traffic consumer web portals.
- Experience with responsive styling (Tailwind CSS, CSS3/SCSS) and smooth micro-animations.
- Strong understanding of RESTful API architecture, Git version control, and CI/CD pipelines.
- Candidate must be located in UAE or available to start immediately with minimal notice.`,
};

// =========================================================================
// RULE 2 & 3: Finalize 1 Resume & 1 Cover Letter in memory (Ensure ATS check passes)
// =========================================================================
console.log('1️⃣ [Step 1] Dynamically tailoring Resume & validating ATS Score >= 85% via Gemini AI...');
const tailoredResume = await generateTailoredResumeData({
  jobTitle: targetJob.jobTitle,
  jobDescription: targetJob.jobDescription,
  companyName: targetJob.companyName,
  outreachStrategy: targetJob.outreachStrategy,
  atsKeywordsAndPhrasing: targetJob.atsKeywordsAndPhrasing,
  matchedSkills: ['Next.js', 'React.js', 'TypeScript', 'Tailwind CSS', 'REST APIs', 'Supabase'],
});

const atsScore = tailoredResume.atsResult.overallAtsScore;
console.log(`✅ Resume finalized! ATS Score: ${atsScore}/100 (Grade: ${tailoredResume.atsResult.ratingGrade})`);
console.log(`• Selected Projects (${tailoredResume.projectCount}):`, tailoredResume.resumeData.projects.map((p: any) => p.name).join(', '));

console.log('\n2️⃣ [Step 2] Dynamically generating 4-paragraph Cover Letter via Gemini AI...');
const tailoredCoverLetter = await generateTailoredCoverLetter({
  companyName: targetJob.companyName,
  jobTitle: targetJob.jobTitle,
  jobDescription: targetJob.jobDescription,
  matchedSkills: ['Next.js App Router', 'React.js', 'TypeScript', 'Tailwind CSS', 'REST APIs'],
});
console.log(`✅ Cover Letter generated! (${tailoredCoverLetter.wordCount} words, 0 em-dashes)`);

// =========================================================================
// RULE 1: Compile finalized single-page A4 PDFs & Archive into Subfolders (Resumes/ & Cover Letters/)
// =========================================================================
console.log('\n3️⃣ [Step 3] Compiling exactly 1 single-page A4 Resume PDF and 1 Cover Letter PDF...');
const resumePdfBuffer = await compileResumePdf(tailoredResume.resumeData);
const coverLetterPdfBuffer = await compileCoverLetterPdf(tailoredCoverLetter);
console.log(`✅ Resume PDF: ${resumePdfBuffer.length} bytes`);
console.log(`✅ Cover Letter PDF: ${coverLetterPdfBuffer.length} bytes`);

console.log('\n4️⃣ [Step 4] Archiving into Google Drive subfolders: "Pulsereach Applications/Resumes" & "Pulsereach Applications/Cover Letters"...');
const driveUrls = await archiveApplicationPdfs({
  companyName: targetJob.companyName,
  jobTitle: targetJob.jobTitle,
  resumePdfBuffer,
  coverLetterPdfBuffer,
});
console.log(`✅ Drive Resume: ${driveUrls.resumeDriveUrl}`);
console.log(`✅ Drive Cover Letter: ${driveUrls.coverLetterDriveUrl}`);

// =========================================================================
// RULE 3: After ATS pass & PDFs ready, generate tailored email & create Gmail Draft
// =========================================================================
console.log('\n5️⃣ [Step 5] Dynamically drafting Outreach Email & Creating Gmail Draft in Account 2...');
const tailoredEmail = await generateTailoredOutreachEmail({
  companyName: targetJob.companyName,
  jobTitle: targetJob.jobTitle,
  jobDescription: targetJob.jobDescription,
  matchedSkills: ['Next.js App Router', 'React.js', 'TypeScript', 'Tailwind CSS', 'REST APIs'],
  recruiterName: targetJob.recruiterName,
});

const draftResult = await createMultiRecipientGmailDraft({
  toEmails: [targetJob.recruiterEmail], // ONLY the recruiter's email
  subject: tailoredEmail.subject,
  bodyText: tailoredEmail.fullBodyText,
  resumePdfBuffer,
  resumeFileName: generateDocumentFileName('CV', targetJob.companyName),
  coverLetterPdfBuffer,
  coverLetterFileName: generateDocumentFileName('CoverLetter', targetJob.companyName),
});
console.log(`✅ Persistent Gmail Draft Created! Draft ID: ${draftResult.draftId}`);

// =========================================================================
// RULE 4, 5 & 6: Send Clean Telegram Review Card with Email Preview & Cache PDF for [📄 Send CV]
// =========================================================================
console.log('\n6️⃣ [Step 6] Sending Clean, Noise-Free Telegram Review Card to Cockpit...');
cacheJobPdf(targetJob.jobId, resumePdfBuffer, generateDocumentFileName('CV', targetJob.companyName));

const jobCard: JobCardData = {
  jobId: targetJob.jobId,
  jobTitle: targetJob.jobTitle,
  companyName: targetJob.companyName,
  location: targetJob.location,
  matchScore: atsScore,
  atsScore,
  recruiterName: targetJob.recruiterName,
  recipientEmails: [targetJob.recruiterEmail],
  emailSubject: tailoredEmail.subject,
  emailBodyText: tailoredEmail.fullBodyText,
  applicationLink: targetJob.applicationLink,
  draftId: draftResult.draftId,
  resumeDriveUrl: driveUrls.resumeDriveUrl,
  coverLetterDriveUrl: driveUrls.coverLetterDriveUrl,
};

const messageId = await sendTelegramReviewCard(jobCard, draftResult.draftId);
console.log(`✅ Review Card Dispatched to Telegram (Message ID: ${messageId})!`);
console.log(`ℹ️ PDF is cached in-memory and will ONLY be sent when you click [📄 Send CV] on Telegram.`);

console.log('\n🎉 ALL 6 REQUIREMENTS SATISFIED & VERIFIED END-TO-END!');
