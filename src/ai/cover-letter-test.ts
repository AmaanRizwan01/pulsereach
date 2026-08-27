import { generateCoverLetter } from './cover-letter-generator.js';
import { getCachedProfile } from '../profile/profile-loader.js';

console.log('=== Test 1: Testing 4-Paragraph Cover Letter Generation ===');

const profile = getCachedProfile();
const sampleJob = {
  jobTitle: 'Full-Stack Developer (Next.js & TypeScript)',
  companyName: 'Careem',
  jobDescription: `
Careem is looking for a Full-Stack Engineer to scale our Super App web services.
Requirements:
- Expertise in React, Next.js (App Router), TypeScript, and Node.js.
- Strong backend experience with PostgreSQL, REST APIs, and containerized deployments (Docker).
- Experience building scalable architectures with high uptime and low latency.
- Based in UAE with immediate availability preferred.
  `,
  matchedSkills: ['Next.js (App Router)', 'TypeScript', 'PostgreSQL', 'Docker', 'REST APIs'],
  outreachStrategy: 'Emphasize SaaS backend architectures, atomic transaction handling, and self-hosted infrastructure.',
  atsKeywordsAndPhrasing: 'Keywords: Next.js App Router, TypeScript, PostgreSQL, Docker, Scalable Architecture.',
};

const result = await generateCoverLetter(sampleJob);

console.log('• Recipient Title:', result.recipientTitle);
console.log('• Word Count:', result.wordCount, '(Target: 250-350, max 400)');
console.log('• Total Body Paragraphs:', result.bodyParagraphs.length, '(Expected: 2)');

console.log('\n--- Generated Markdown Preview ---');
console.log(result.fullMarkdown);
console.log('----------------------------------\n');

// Assertions
if (result.bodyParagraphs.length !== 2) {
  console.error(`❌ Expected exactly 2 body paragraphs, got ${result.bodyParagraphs.length}`);
  process.exit(1);
}

if (result.wordCount < 180 || result.wordCount > 400) {
  console.error(`❌ Word count ${result.wordCount} outside acceptable range (180-400 words)`);
  process.exit(1);
} else {
  console.log('✅ Word count within optimal single-page A4 range!');
}

console.log('\n=== Test 2: Testing Strict Zero Em-Dash Policy ===');
const markdownEmDash = result.fullMarkdown.match(/[—–]|--/g);
const htmlEmDash = result.fullHtml.match(/[—–]|--/g);

if (markdownEmDash && markdownEmDash.length > 0) {
  console.error('❌ Em-dashes found in cover letter markdown:', markdownEmDash);
  process.exit(1);
}

if (htmlEmDash && htmlEmDash.length > 0) {
  console.error('❌ Em-dashes found in cover letter HTML:', htmlEmDash);
  process.exit(1);
}

console.log('✅ Strict zero em-dash compliance verified across markdown and HTML!');

console.log('\n=== Test 3: Testing A4 HTML Template Structure ===');
if (
  !result.fullHtml.includes('<!DOCTYPE html>') ||
  !result.fullHtml.includes(profile.name) ||
  !result.fullHtml.includes('Careem')
) {
  console.error('❌ Compiled HTML missing required document tags or company name');
  process.exit(1);
} else {
  console.log('✅ Single-page A4 HTML template successfully compiled!');
}

console.log('\n🎉 ALL COVER LETTER TESTS PASSED!');
