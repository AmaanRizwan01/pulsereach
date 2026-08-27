import { getCachedProfile } from '../profile/profile-loader.js';
import { ResumeData, generateResumeHtml } from './resume-compiler.js';
import { generateCoverLetterHtml } from './cover-letter-generator.js';
import { compileResumePdf, compileCoverLetterPdf } from './pdf-compiler.js';
import { chromium } from 'playwright';

console.log('=== Test 1: Testing Resume PDF Compilation with Certifications (3-Project Layout) ===');

const catalog = getCachedProfile();
const projectList = Object.values(catalog.projects || {});

const resume3Project: ResumeData = {
  name: catalog.name,
  visaStatus: catalog.visaStatus,
  phone: catalog.phone,
  email: catalog.email,
  linkedinUrl: catalog.linkedinUrl,
  githubUrl: catalog.githubUrl,
  portfolioUrl: catalog.portfolioUrl,
  headline: catalog.defaultHeadline,
  summary: catalog.defaultSummary,
  skills: catalog.skills,
  experience: catalog.experience,
  projects: projectList.slice(0, 3),
  education: catalog.education,
  certifications: catalog.certifications,
};

const startResume = Date.now();
const resumeBuffer = await compileResumePdf(resume3Project);
const resumeDuration = Date.now() - startResume;

console.log(`• Resume PDF generated in ${resumeDuration}ms`);
console.log(`• Resume PDF Buffer Size: ${resumeBuffer.length} bytes`);

// Verify PDF header %PDF-
const isResumeValidPdf = resumeBuffer.toString('utf-8', 0, 5).startsWith('%PDF-');
if (!isResumeValidPdf) {
  console.error('❌ Resume buffer is not a valid PDF document (missing %PDF- header)');
  process.exit(1);
} else {
  console.log('✅ Resume PDF binary header (%PDF-) verified!');
}

if (resumeBuffer.length < 15000) {
  console.error(`❌ Resume PDF unexpectedly small (${resumeBuffer.length} bytes)`);
  process.exit(1);
}

console.log('\n=== Test 2: Testing Cover Letter PDF Compilation ===');

const coverLetterHtml = generateCoverLetterHtml({
  candidateName: catalog.name,
  candidateLocation: catalog.visaStatus,
  candidatePhone: catalog.phone,
  candidateEmail: catalog.email,
  companyName: 'Careem',
  recipientTitle: 'Hiring Team',
  openingParagraph:
    'I am writing to express my strong interest in the Software Engineer opening at Careem. Based in Ajman, UAE under a UAE Residence Visa, I am available immediately with 0 days notice.',
  bodyParagraphs: [
    'My technical stack is centered on Next.js, React, TypeScript, and high-performance backend systems with PostgreSQL and Docker.',
    'In my Intralead SaaS project, I engineered atomic wallet transactions with Dodo Payments, and in my Proxmox homelab, I achieved 75% power reduction with Cloudflare Zero Trust.',
  ],
  closingParagraph:
    'I look forward to discussing how my technical background and immediate local availability can drive value for your engineering team.',
});

const startCover = Date.now();
const coverBuffer = await compileCoverLetterPdf({ fullHtml: coverLetterHtml });
const coverDuration = Date.now() - startCover;

console.log(`• Cover Letter PDF generated in ${coverDuration}ms`);
console.log(`• Cover Letter PDF Buffer Size: ${coverBuffer.length} bytes`);

const isCoverValidPdf = coverBuffer.toString('utf-8', 0, 5).startsWith('%PDF-');
if (!isCoverValidPdf) {
  console.error('❌ Cover letter buffer is not a valid PDF document');
  process.exit(1);
} else {
  console.log('✅ Cover Letter PDF binary header (%PDF-) verified!');
}

console.log('\n=== Test 3: Testing 4-Project High-Density Resume PDF Compilation ===');

const resume4Project: ResumeData = {
  ...resume3Project,
  projects: [
    catalog.projects.intralead,
    catalog.projects.proxmox_infra,
    catalog.projects.lisa_flowers,
    catalog.projects.route21,
  ],
  certifications: catalog.certifications,
};

const resume4Buffer = await compileResumePdf(resume4Project);
console.log(`• 4-Project Resume PDF Buffer Size: ${resume4Buffer.length} bytes`);
const isResume4Valid = resume4Buffer.toString('utf-8', 0, 5).startsWith('%PDF-');
if (!isResume4Valid) {
  console.error('❌ 4-Project Resume buffer is invalid');
  process.exit(1);
} else {
  console.log('✅ 4-Project high-density Resume PDF successfully rendered!');
}

console.log('\n=== Test 4: Verifying Single-Page A4 Height Bounds in Chromium ===');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  
  // Test 3-project HTML height
  const html3 = generateResumeHtml(resume3Project);
  await page.setContent(html3, { waitUntil: 'domcontentloaded' });
  const height3 = await page.evaluate(() => document.body.scrollHeight);
  console.log(`• 3-Project Resume Rendered Body Height: ${height3}px (A4 printable target: 950-1080px)`);

  // Test 4-project HTML height
  const html4 = generateResumeHtml(resume4Project);
  await page.setContent(html4, { waitUntil: 'domcontentloaded' });
  const height4 = await page.evaluate(() => document.body.scrollHeight);
  console.log(`• 4-Project Resume Rendered Body Height: ${height4}px (A4 printable target: 950-1080px)`);

  if (height3 > 1120 || height4 > 1120) {
    console.error(`❌ Height exceeds single A4 printable boundary (>1120px): 3-proj=${height3}px, 4-proj=${height4}px`);
    process.exit(1);
  } else {
    console.log('✅ Both 3-project and 4-project layouts fit strictly on 1 single A4 page without spillover!');
  }
} finally {
  await browser.close();
}

console.log('\n🎉 ALL SPRINT 8 PLAYWRIGHT PDF COMPILATION & SINGLE-PAGE TESTS PASSED!');
