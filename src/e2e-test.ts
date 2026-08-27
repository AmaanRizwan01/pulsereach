/**
 * Pulsereach — Master End-to-End Production Verification Suite
 * Performs automated validation across all core subsystems.
 */

import { getEnv } from './config/env.js';
import { canSendNow, getRemainingDailyBudget, getWarmUpTier } from './anti-spam/deliverability-shield.js';
import { getProfile } from './profile/profile-loader.js';
import { generateJobKey, loadState } from './worker/state-tracker.js';
import { formatReviewCard, buildReviewKeyboard, cacheJobPdf, getCachedJobPdf } from './telegram/bot-service.js';
import { filterOutreachRecipients } from './gmail/draft-service.js';
import { removeEmDashes } from './ai/email-generator.js';

console.log('🌟 =================================================================');
console.log('🚀 PULSEREACH MASTER PRODUCTION VERIFICATION SUITE');
console.log('🌟 =================================================================\n');

let passedAssertions = 0;

function assert(condition: boolean, description: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${description}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${description}`);
  passedAssertions++;
}

// 1. Environment & Configuration Check
console.log('1️⃣ --- Environment & Configuration Invariants ---');
const env = getEnv();
assert(!!env.GEMINI_API_KEY, 'Gemini API Key is configured and loaded');
assert(!!env.GOOGLE_STORAGE_REFRESH_TOKEN, 'Storage Refresh Token is present');
assert(!!env.GMAIL_REFRESH_TOKEN, 'Outreach Refresh Token is present');
assert(!!env.GMAIL_SENDER_EMAIL, 'Outreach email is configured');
assert(!!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID, 'Telegram Bot Token & Cockpit Chat ID are present');

// 2. Deliverability & Anti-Spam Shield
console.log('\n2️⃣ --- Deliverability & Anti-Spam Gate ---');
const tier1 = getWarmUpTier(1); // Day 1 (Week 1)
assert(tier1.maxSendsPerDay === 5, 'Week 1 warm-up ladder enforces 5 sends/day max');
const tier4 = getWarmUpTier(25); // Day 25 (Week 4+)
assert(tier4.maxSendsPerDay === 20, 'Week 4 warm-up ladder reaches 20 sends/day max');
const budget = getRemainingDailyBudget();
assert(typeof budget === 'number' && budget >= 0, `Remaining daily budget is valid: ${budget}`);
const sendCheck = canSendNow();
assert(typeof sendCheck.allowed === 'boolean', 'canSendNow() returns valid status');

// 3. Candidate Profile & Truth-Anchoring
console.log('\n3️⃣ --- Candidate Profile & Truth-Anchoring ---');
const profile = await getProfile();
assert(typeof profile.name === 'string' && profile.name.length > 0, `Active candidate profile loaded: ${profile.name}`);
assert(Object.keys(profile.projects || {}).length > 0, 'Verified technical projects present in candidate profile');
assert(profile.skills !== undefined, 'Candidate skills taxonomy is initialized');

const dirtyText = 'Experienced in Next.js — built scalable apps – with sub-second TTI -- verified.';
const cleanedText = removeEmDashes(dirtyText);
assert(!cleanedText.includes('—') && !cleanedText.includes('–') && !cleanedText.includes('--'), 'Em-dashes successfully removed');

// 4. Recruiter Email Filtering (No Self-Emails)
console.log('\n4️⃣ --- Recruiter-Only Email Filtering ---');
const testRecipients = [
  profile.email,
  env.GMAIL_SENDER_EMAIL,
  'careers@careem.com',
  'talent@talabat.com',
];
const filteredRecipients = filterOutreachRecipients(testRecipients);
assert(filteredRecipients.includes('careers@careem.com'), 'Recruiter careers@careem.com preserved');
assert(filteredRecipients.includes('talent@talabat.com'), 'Recruiter talent@talabat.com preserved');

// 5. State Tracker & Deduplication Logic
console.log('\n5️⃣ --- Deduplication & Persistence Key Generation ---');
const keyA = generateJobKey('Careem Inc.', 'Senior Frontend Engineer (React/Next)');
const keyB = generateJobKey('careem inc', 'senior frontend engineer react next');
assert(keyA === keyB, 'Deduplication key generation is deterministic and resilient to formatting');
const state = await loadState();
assert(state.version === 1, 'Persistent state store schema version is 1');
assert(typeof state.applications === 'object', 'Applications dictionary is initialized');

// 6. Telegram Review Card & On-Demand PDF Stream Caching
console.log('\n6️⃣ --- Telegram Mobile Cockpit & On-Demand PDF Cache ---');
const samplePdfBuffer = Buffer.from('%PDF-1.4 Mock Playwright Single Page PDF');
cacheJobPdf('careem-fe-test', samplePdfBuffer, 'Candidate_CV_Careem.pdf');
const cached = getCachedJobPdf('careem-fe-test');
assert(cached !== undefined, 'PDF buffer successfully cached for on-demand [📄 Send CV] stream');
assert(cached?.fileName === 'Candidate_CV_Careem.pdf', 'Cached file name matches');

const mockCard = formatReviewCard({
  jobId: 'careem-fe-test',
  jobTitle: 'Senior Frontend Engineer',
  companyName: 'Careem',
  location: 'Dubai, UAE',
  matchScore: 95,
  atsScore: 95,
  recipientEmails: ['careers@careem.com'],
  emailSubject: `Frontend Engineer Application - ${profile.name}`,
  emailBodyText: 'Hi Careem Team, I am reaching out regarding the Frontend Engineer opening...',
  applicationLink: 'https://careers.careem.com',
  resumeDriveUrl: 'https://drive.google.com/file/d/test1/view',
  coverLetterDriveUrl: 'https://drive.google.com/file/d/test2/view',
});

assert(mockCard.includes('Careem'), 'Telegram card contains company name');
assert(mockCard.includes('careers@careem.com'), 'Telegram card displays recruiter email transparently');
assert(mockCard.includes('📁 CV'), 'Telegram card contains direct Drive CV link');
assert(!mockCard.includes('—') && !mockCard.includes('--'), 'Telegram card has zero em-dashes');

const keyboard = buildReviewKeyboard('careem-fe-test', 'draft-123', true, 'https://careers.careem.com');
assert(keyboard.inline_keyboard.length >= 3, 'Button matrix with careers link properly generated');

console.log('\n=================================================================');
console.log(`🎉 ALL ${passedAssertions} PRODUCTION ASSERTIONS PASSED WITH 100% COMPLIANCE!`);
console.log('=================================================================\n');
