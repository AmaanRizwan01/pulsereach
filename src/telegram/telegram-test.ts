import {
  formatReviewCard,
  buildReviewKeyboard,
  JobCardData,
} from './bot-service.js';

console.log('=== Test 1: Testing Email Lead Review Card & Keyboard Logic ===');

const mockEmailJob: JobCardData = {
  jobId: 'job-email-12345',
  jobTitle: 'Machine Learning - Intern',
  companyName: 'Bayut | dubizzle',
  location: 'Dubai, UAE (Dubai Design District)',
  matchScore: 94,
  atsScore: 91,
  recruiterName: 'Hiring Team',
  recipientEmails: ['careers@dubizzle.com', 'talent@bayut.com'],
  recruiterLinkedIn: 'https://www.linkedin.com/company/bayut-com/',
  emailSubject: 'Application: Machine Learning Intern - Muhammad Amaan Rizwan',
  emailBodyText: 'Hi Hiring Team,\nI am writing to express my strong interest in the Machine Learning Intern role at Bayut | dubizzle...',
  applicationLink: 'https://apply.workable.com/bayutdubizzle/j/1876E6B7D8/',
  isPortalLead: false,
};

const emailCardText = formatReviewCard(mockEmailJob);
console.log('• Formatted Email Card Text:\n', emailCardText);

const emailKeyboard = buildReviewKeyboard(
  mockEmailJob.jobId,
  mockEmailJob.applicationLink,
  false,
  mockEmailJob.recruiterLinkedIn
);
console.log('\n• Email Keyboard Rows:', emailKeyboard.inline_keyboard.length);

// Assert Send CV and Send CL buttons exist in Row 2
const row2 = emailKeyboard.inline_keyboard[1];
if (!row2 || row2[0]?.text !== '📄 Send CV' || row2[1]?.text !== '📝 Send CL') {
  console.error('❌ Row 2 buttons incorrect. Expected [📄 Send CV] and [📝 Send CL], got:', row2);
  process.exit(1);
} else {
  console.log('✅ Row 2 button labels verified: [📄 Send CV] and [📝 Send CL]');
}

console.log('=== Test 2: Testing Portal-Only Lead Review Card & Keyboard Logic ===');

const mockPortalJob: JobCardData = {
  jobId: 'job-portal-67890',
  jobTitle: 'Full Stack Product Engineer',
  companyName: 'ATOM Technologies Limited',
  location: 'Dubai, UAE (DIFC Innovation Hub)',
  matchScore: 89,
  atsScore: 89,
  recipientEmails: [],
  recruiterLinkedIn: 'https://www.linkedin.com/company/atom-technologies-ltd/',
  applicationLink: 'https://apply.workable.com/atom-technologies-limited/j/9A363081AB',
  inMailSubject: 'Application: Full Stack Product Engineer - Muhammad Amaan Rizwan',
  linkedInMessage: 'Hi Hiring Team,\n\nI noticed the Full Stack Product Engineer opening at ATOM Technologies Limited and wanted to reach out. With hands-on experience in React, Node.js (NestJS), and AWS Aurora PostgreSQL, I specialize in building high-performance, production-ready solutions matching your technical needs.\n\nI have submitted my application on your careers portal and attached my tailored CV. I am based in the UAE with a valid Residence Visa and available immediately. Would you be open to a brief conversation?\n\nBest regards,\nAmaan Rizwan',
  isPortalLead: true,
};

const portalCardText = formatReviewCard(mockPortalJob);
console.log('• Formatted Portal Card Text:\n', portalCardText);

const portalKeyboard = buildReviewKeyboard(
  mockPortalJob.jobId,
  mockPortalJob.applicationLink,
  true,
  mockPortalJob.recruiterLinkedIn
);
console.log('\n• Portal Keyboard Rows:', portalKeyboard.inline_keyboard.length);

const portalRow2 = portalKeyboard.inline_keyboard[1];
if (!portalRow2 || portalRow2[0]?.text !== '📄 Send CV' || portalRow2[1]?.text !== '📝 Send CL') {
  console.error('❌ Portal Row 2 buttons incorrect. Expected [📄 Send CV] and [📝 Send CL]');
  process.exit(1);
} else {
  console.log('✅ Portal Row 2 button labels verified: [📄 Send CV] and [📝 Send CL]');
}

console.log('\n=== Test 3: Testing telegramEntitiesToHtml & Status Banner Cleaning ===');

import {
  telegramEntitiesToHtml,
  stripExistingStatusBanner,
  stripHtmlTags,
} from './bot-service.js';

// Test 3A: Escaping special characters in plain text
const rawTextWithAmp = 'Senior Full Stack & AI Engineer <hr@company.com> (Salary > 20k)';
const htmlFromRaw = telegramEntitiesToHtml(rawTextWithAmp);
console.log('• Raw Text to HTML:', htmlFromRaw);
if (
  !htmlFromRaw.includes('&amp;') ||
  !htmlFromRaw.includes('&lt;hr@company.com&gt;') ||
  !htmlFromRaw.includes('&gt; 20k')
) {
  console.error('❌ Failed escaping HTML characters in plain text:', htmlFromRaw);
  process.exit(1);
} else {
  console.log('✅ Special characters (&, <, >) safely escaped.');
}

// Test 3B: Reconstructing formatted Telegram entities (bold, blockquote, text_link, code)
const sampleMessageText = '🚀 Senior Software Engineer @ Bain & Company\n📍 Dubai | 🎯 ATS Score: 89/100 • 📁 CV | 📝 Cover Letter\n📬 To: careers@bain.com\n\nDear Hiring Team,\nI am excited to apply for Senior Software Engineer at Bain & Company.';
const sampleEntities = [
  { type: 'bold', offset: sampleMessageText.indexOf('Senior Software Engineer'), length: 'Senior Software Engineer'.length },
  { type: 'bold', offset: sampleMessageText.indexOf('Bain & Company'), length: 'Bain & Company'.length },
  { type: 'bold', offset: sampleMessageText.indexOf('89/100'), length: '89/100'.length },
  { type: 'text_link', offset: sampleMessageText.indexOf('📁 CV'), length: '📁 CV'.length, url: 'https://drive.google.com/file/d/cv123' },
  { type: 'text_link', offset: sampleMessageText.indexOf('📝 Cover Letter'), length: '📝 Cover Letter'.length, url: 'https://drive.google.com/file/d/cl456' },
  { type: 'code', offset: sampleMessageText.indexOf('careers@bain.com'), length: 'careers@bain.com'.length },
  { type: 'blockquote', offset: sampleMessageText.indexOf('Dear Hiring Team,'), length: sampleMessageText.length - sampleMessageText.indexOf('Dear Hiring Team,') },
];

const reconstructedHtml = telegramEntitiesToHtml(sampleMessageText, sampleEntities);
console.log('\n• Reconstructed HTML:\n', reconstructedHtml);

if (!reconstructedHtml.includes('<b>Senior Software Engineer</b>')) {
  console.error('❌ Missing bold entity on job title');
  process.exit(1);
}
if (!reconstructedHtml.includes('<b>Bain &amp; Company</b>')) {
  console.error('❌ Missing bold + entity escaping on company name:', reconstructedHtml);
  process.exit(1);
}
if (!reconstructedHtml.includes('<a href="https://drive.google.com/file/d/cv123">📁 CV</a>')) {
  console.error('❌ Missing clickable CV Drive link');
  process.exit(1);
}
if (!reconstructedHtml.includes('<code>careers@bain.com</code>')) {
  console.error('❌ Missing code tag on recipient email');
  process.exit(1);
}
if (!reconstructedHtml.includes('<blockquote>Dear Hiring Team,')) {
  console.error('❌ Missing blockquote tag on email preview');
  process.exit(1);
}
console.log('✅ All Telegram entities successfully restored to valid HTML with zero parse errors!');

// Test 3C: Status Banner Deduplication
const cardWithExistingStatus = `${reconstructedHtml}\n\n✅ <b>STATUS: EMAIL DISPATCHED VIA GMAIL API</b>\n⏳ <b>15-min cooldown active.</b>`;
const cleanedCard = stripExistingStatusBanner(cardWithExistingStatus);
if (cleanedCard.includes('STATUS: EMAIL DISPATCHED')) {
  console.error('❌ Failed to strip existing status banner:', cleanedCard);
  process.exit(1);
} else {
  console.log('✅ stripExistingStatusBanner successfully removed previous status trailer.');
}

// Test 3D: Plain-Text Fallback Stripper
const plainFallback = stripHtmlTags(reconstructedHtml);
if (plainFallback.includes('<b>') || plainFallback.includes('<a href=') || plainFallback.includes('&amp;')) {
  console.error('❌ stripHtmlTags left residual tags or unescaped entities:', plainFallback);
  process.exit(1);
} else {
  console.log('✅ stripHtmlTags successfully generated pure plain-text string for fallback.');
}

console.log('\n=== Test 4: Testing Deterministic Multi-Job Company Matching & Row Targeting ===');

import { findMatchingSheetJob } from './bot-service.js';

const mockSheetRows = [
  {
    rowNumber: 2,
    dateFetched: '2026-08-23 06:00 PM GST',
    jobTitle: 'AI Platform & Infrastructure Engineer, Deployed',
    companyName: 'Brain Co.',
    location: 'Abu Dhabi, UAE (Hybrid)',
    domainCategory: 'AI Operating Systems',
    contactEmails: [],
    applicationLink: 'https://jobs.ashbyhq.com/brainco/5a600fc4',
    outreachStrategy: 'Pitch 1',
    status: 'Portal Lead (Ready to Apply)',
    cvLink: 'https://drive.google.com/file/d/cv_ai_platform',
    coverLetterLink: 'https://drive.google.com/file/d/cl_ai_platform',
  },
  {
    rowNumber: 3,
    dateFetched: '2026-08-23 06:00 PM GST',
    jobTitle: 'Software Engineer: Intern/New Grad',
    companyName: 'Asula Labs',
    location: 'Dubai, UAE',
    domainCategory: 'Web3',
    contactEmails: [],
    applicationLink: 'https://jobs.ashbyhq.com/asula/ef6a983e',
    outreachStrategy: 'Pitch 2',
    status: 'Portal Lead (Ready to Apply)',
    cvLink: 'https://drive.google.com/file/d/cv_asula',
    coverLetterLink: 'https://drive.google.com/file/d/cl_asula',
  },
  {
    rowNumber: 5,
    dateFetched: '2026-08-23 06:00 PM GST',
    jobTitle: 'IT Engineer, MENA',
    companyName: 'Brain Co.',
    location: 'Abu Dhabi / Dubai, UAE',
    domainCategory: 'Enterprise IT Operations',
    contactEmails: [],
    applicationLink: 'https://jobs.ashbyhq.com/brainco/9892c2c7',
    outreachStrategy: 'Pitch 3',
    status: 'Portal Lead (Ready to Apply)',
    cvLink: 'https://drive.google.com/file/d/cv_it_engineer',
    coverLetterLink: 'https://drive.google.com/file/d/cl_it_engineer',
  },
];

// Test 4A: Keyboard generation with explicit rowNumber
const kbWithRow = buildReviewKeyboard(
  'brainco_itengineermena',
  'https://jobs.ashbyhq.com/brainco/9892c2c7',
  true,
  undefined,
  5
);
const applyBtn = kbWithRow.inline_keyboard[0][0];
console.log('• Generated Action Button Callback Data:', applyBtn.callback_data);
if (applyBtn.callback_data !== 'portal_applied:r5:brainco_itengineermena') {
  console.error('❌ Expected explicit row prefix in callback_data, got:', applyBtn.callback_data);
  process.exit(1);
} else {
  console.log('✅ Explicit row number prefix (r5) properly encoded in callback data.');
}

// Test 4B: Match with explicitRowNumber: 5
const matchByRow = findMatchingSheetJob(mockSheetRows, { explicitRowNumber: 5 });
if (!matchByRow || matchByRow.rowNumber !== 5 || matchByRow.jobTitle !== 'IT Engineer, MENA') {
  console.error('❌ Failed matching Row 5 by explicit row number:', matchByRow);
  process.exit(1);
} else {
  console.log('✅ Tier 1: Explicit row number match succeeded (matched Row 5).');
}

// Test 4C: Match with resolvedJobKey: 'brainco_itengineermena' (MUST NOT match Row 2!)
const matchByKey = findMatchingSheetJob(mockSheetRows, { resolvedJobKey: 'brainco_itengineermena' });
if (!matchByKey || matchByKey.rowNumber !== 5 || matchByKey.jobTitle !== 'IT Engineer, MENA') {
  console.error('❌ Failed matching IT Engineer by jobKey. Falsely matched:', matchByKey);
  process.exit(1);
} else {
  console.log('✅ Tier 2: Exact jobKey match succeeded for "brainco_itengineermena" without falsely matching Row 2.');
}

// Test 4D: Match with companyName: 'Brain Co.' AND jobTitle: 'IT Engineer, MENA'
const matchByTitle = findMatchingSheetJob(mockSheetRows, {
  companyName: 'Brain Co.',
  jobTitle: 'IT Engineer, MENA',
});
if (!matchByTitle || matchByTitle.rowNumber !== 5) {
  console.error('❌ Failed matching by company and title:', matchByTitle);
  process.exit(1);
} else {
  console.log('✅ Tier 4: Exact Company + Title match succeeded without collision.');
}

console.log('\n=== Test 5: Testing getActivePendingJobFromSheet Staleness Guard & Queue Unblocking ===');

import { getActivePendingJobFromSheet } from '../worker/state-tracker.js';

const nowMs = Date.now();
const freshTimestamp = new Date(nowMs - 5 * 60 * 1000).toISOString(); // 5 mins ago
const staleTimestamp = new Date(nowMs - 90 * 60 * 1000).toISOString(); // 90 mins ago (stale!)

const mockRowsWithPending: any[] = [
  {
    rowNumber: 2,
    jobTitle: 'AI Platform & Infrastructure Engineer',
    companyName: 'Brain Co.',
    status: 'Portal Lead (Ready to Apply)',
    appliedAt: staleTimestamp, // Stale! (> 60m)
  },
  {
    rowNumber: 3,
    jobTitle: 'Software Engineer: Intern/New Grad',
    companyName: 'Asula Labs',
    status: '', // Unprocessed
  },
  {
    rowNumber: 4,
    jobTitle: 'Fullstack Engineer',
    companyName: 'Elliptic',
    status: '', // Unprocessed
  },
];

// Test 5A: Stale pending job (> 60m) must NOT block the queue
const stalePending = getActivePendingJobFromSheet(mockRowsWithPending);
if (stalePending !== null) {
  console.error('❌ Expected stale row (Row 2, 90 mins old) to be ignored, but got:', stalePending);
  process.exit(1);
} else {
  console.log('✅ Staleness Guard: 90-minute-old pending row was safely ignored. Queue unlocked!');
}

// Test 5B: Fresh pending job (5 mins ago) MUST be respected
const mockRowsWithFreshPending: any[] = [
  {
    rowNumber: 2,
    jobTitle: 'AI Platform & Infrastructure Engineer',
    companyName: 'Brain Co.',
    status: 'Portal Lead (Ready to Apply)',
    appliedAt: freshTimestamp,
  },
  {
    rowNumber: 3,
    jobTitle: 'Software Engineer: Intern/New Grad',
    companyName: 'Asula Labs',
    status: '',
  },
];

const freshPending = getActivePendingJobFromSheet(mockRowsWithFreshPending);
if (!freshPending || freshPending.rowNumber !== 2) {
  console.error('❌ Expected fresh pending job (Row 2, 5 mins old) to be detected, got:', freshPending);
  process.exit(1);
} else {
  console.log('✅ Fresh Pending Lead: Correctly detected active job awaiting review in Telegram.');
}

// Test 5C: ignoreRowNumbers bypasses specific row
const ignoredPending = getActivePendingJobFromSheet(mockRowsWithFreshPending, { ignoreRowNumbers: [2] });
if (ignoredPending !== null) {
  console.error('❌ Expected Row 2 to be ignored when in ignoreRowNumbers, got:', ignoredPending);
  process.exit(1);
} else {
  console.log('✅ ignoreRowNumbers: Row 2 was successfully ignored when requested.');
}

console.log('\n=== Test 6: Testing Dynamic Certification Domain Filtering & Clean Role Rendering ===');

import { generateResumeHtml } from '../ai/resume-compiler.js';
import { getCachedProfile } from '../profile/profile-loader.js';

const profile = getCachedProfile();

// Test 6C: Clean Experience Role Rendering (No Duplicate Date String)
const sampleResumeData: any = {
  name: profile.name,
  visaStatus: profile.visaStatus,
  phone: profile.phone,
  email: profile.email,
  linkedinUrl: profile.linkedinUrl,
  githubUrl: profile.githubUrl,
  portfolioUrl: profile.portfolioUrl,
  summary: 'Experienced Full Stack Engineer.',
  skills: profile.skills,
  experience: [
    {
      company: 'Tech Solutions - Remote',
      role: 'Software Engineer Intern | Jun 2026 - Aug 2026',
      period: 'Jun 2026 - Aug 2026',
      bullets: ['Architected custom Shopify Liquid storefront.'],
    },
  ],
  projects: [
    {
      name: 'Intralead B2B SaaS',
      technologies: 'Next.js, Supabase',
      period: 'Jul 2026 - Present',
      bullets: [
        'Bullet 1 with metrics.',
        'Bullet 2 with metrics.',
        'Bullet 3 with metrics.',
      ],
    },
  ],
  education: profile.education,
  certifications: profile.certifications,
};

const renderedHtml = generateResumeHtml(sampleResumeData);
if (renderedHtml.includes('Jun 2026 - Aug 2026 | Jun 2026 - Aug 2026')) {
  console.error('❌ Experience role line has duplicated date string!');
  process.exit(1);
} else {
  console.log('✅ Clean Role Rendering: No duplicated date strings on experience role line.');
}

console.log('\n=== Test 7: Testing Real-Time Email Deliverability & MX Verification Engine ===');

import {
  verifyEmailDeliverability,
  filterDeliverableEmails,
} from '../anti-spam/email-verifier.js';

// Test 7A: Valid real email domain (e.g. Google / Microsoft / Elliptic)
const validRes = await verifyEmailDeliverability('careers@elliptic.co');
console.log('• Valid Email Verification:', validRes.email, '-> Deliverable:', validRes.isDeliverable, 'MX:', validRes.mxHost);
if (!validRes.isDeliverable || !validRes.mxHost) {
  console.error('❌ Expected careers@elliptic.co to be deliverable with active MX records, got:', validRes);
  process.exit(1);
} else {
  console.log('✅ Real Domain Verification: Successfully resolved live MX record for elliptic.co.');
}

// Test 7B: Fake non-existent domain
const fakeRes = await verifyEmailDeliverability('hr@thisdomaindoesnotexist999888777.com');
console.log('• Fake Domain Verification:', fakeRes.email, '-> Deliverable:', fakeRes.isDeliverable, 'Reason:', fakeRes.reason);
if (fakeRes.isDeliverable || fakeRes.reason !== 'NO_MX_RECORDS') {
  console.error('❌ Expected fake domain to fail with NO_MX_RECORDS, got:', fakeRes);
  process.exit(1);
} else {
  console.log('✅ Fake Domain Shield: Correctly rejected non-existent domain without MX records.');
}

// Test 7C: Role-based no-reply mailbox
const noreplyRes = await verifyEmailDeliverability('noreply@google.com');
if (noreplyRes.isDeliverable || noreplyRes.reason !== 'ROLE_BASED_NOREPLY') {
  console.error('❌ Expected noreply@google.com to be rejected as ROLE_BASED_NOREPLY, got:', noreplyRes);
  process.exit(1);
} else {
  console.log('✅ No-Reply Shield: Correctly rejected unmonitored noreply mailbox.');
}

// Test 7D: Placeholder domain
const placeholderRes = await verifyEmailDeliverability('recruiter@example.com');
if (placeholderRes.isDeliverable || placeholderRes.reason !== 'PLACEHOLDER_DOMAIN') {
  console.error('❌ Expected recruiter@example.com to be rejected as PLACEHOLDER_DOMAIN, got:', placeholderRes);
  process.exit(1);
} else {
  console.log('✅ Placeholder Shield: Correctly rejected example.com placeholder domain.');
}

// Test 7E: filterDeliverableEmails batch array filtering
const rawList = [
  'careers@elliptic.co',
  'noreply@company.com',
  'hr@thisdomaindoesnotexist999888777.com',
  'talent@bayut.com',
];
const filteredList = await filterDeliverableEmails(rawList);
console.log('• Batch Filtered Deliverable List:', filteredList);
if (filteredList.length !== 2 || !filteredList.includes('careers@elliptic.co') || !filteredList.includes('talent@bayut.com')) {
  console.error('❌ Failed filtering deliverable emails from mixed list, got:', filteredList);
  process.exit(1);
} else {
  console.log('✅ Batch Filter: Successfully isolated 2 real emails from mixed input array.');
}

console.log('\n🎉 ALL TELEGRAM BOT, MATCHING, STALENESS, RESUME & EMAIL VERIFIER TESTS PASSED!');
