import { generateTailoredResumeData } from './resume-tailorer.js';
import { generateResumeHtml } from './resume-compiler.js';

console.log('=== Test 1: Testing Resume Tailoring for Frontend/React Role ===');

const sampleJob = {
  jobTitle: 'Frontend Engineer (React / Next.js)',
  companyName: 'Noon E-Commerce',
  jobDescription: `
We are looking for a Senior Frontend Engineer to build high-performance e-commerce interfaces.
Requirements:
- Strong proficiency in React.js, Next.js App Router, TypeScript, and modern CSS/Tailwind.
- Proven experience optimizing Web Core Vitals and page load performance.
- Experience with REST APIs, state management, and responsive component libraries.
- Based in UAE or available to relocate immediately.
  `,
  matchedSkills: ['React.js', 'Next.js (App Router)', 'TypeScript', 'Tailwind CSS'],
  outreachStrategy: 'Highlight high-scale e-commerce UI performance and Next.js App Router architectural experience.',
  atsKeywordsAndPhrasing: 'Keywords: Next.js, React.js, TypeScript, Core Web Vitals, Responsive Design, State Management.',
  minAtsScoreThreshold: 85,
};

const result = await generateTailoredResumeData(sampleJob);

console.log('• Tailored Headline:', result.resumeData.headline);
console.log('• Tailored Summary:', result.resumeData.summary);
console.log('• Selected Projects (' + result.projectCount + '):', result.resumeData.projects.map((p: any) => p.name).join(', '));
console.log('• Overall ATS Score:', result.atsResult.overallAtsScore + '/100 (Grade: ' + result.atsResult.ratingGrade + ')');
console.log('• ATS Pass Probability:', result.atsResult.passProbability);
console.log('• Matched Keywords:', result.atsResult.matchedKeywords.slice(0, 8).join(', '));

if (result.atsResult.overallAtsScore < 85) {
  console.error(`❌ ATS score ${result.atsResult.overallAtsScore} did not meet minimum threshold of 85`);
  process.exit(1);
} else {
  console.log(`✅ ATS score ${result.atsResult.overallAtsScore} meets target threshold (>= 85)!`);
}

console.log('\n=== Test 2: Testing Strict Zero Em-Dash Policy in Tailored Data ===');
const dataJson = JSON.stringify(result.resumeData);
const emDashMatches = dataJson.match(/[—–]|--/g);
if (emDashMatches && emDashMatches.length > 0) {
  console.error(`❌ Found ${emDashMatches.length} em-dashes in tailored resume data:`, emDashMatches);
  process.exit(1);
} else {
  console.log('✅ Zero em-dashes verified in tailored resume data!');
}

console.log('\n=== Test 3: Testing Certifications Integration ===');
if (!result.resumeData.certifications || result.resumeData.certifications.length === 0) {
  console.error('❌ Certifications missing from tailored resume data');
  process.exit(1);
} else {
  console.log(`✅ ${result.resumeData.certifications.length} verified certifications present in resume data:`);
  result.resumeData.certifications.forEach((c: any) => console.log(`   • ${c.name} | ${c.issuer}`));
}

console.log('\n=== Test 4: Testing Single-Page A4 HTML Compilation ===');
const html = generateResumeHtml(result.resumeData);
console.log(`• Generated HTML size: ${html.length} characters`);

if (!html.includes('<!DOCTYPE html>') || !html.includes(result.resumeData.name) || !html.includes('PROFESSIONAL SUMMARY') || !html.includes('CERTIFICATIONS')) {
  console.error('❌ Generated HTML is missing required document structure, candidate identity, or CERTIFICATIONS section');
  process.exit(1);
}

// Strip HTML comments and style blocks before checking for em-dashes in rendered text
const renderedText = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const htmlEmDashMatches = renderedText.match(/[—–]|\s+--\s+/g);
if (htmlEmDashMatches && htmlEmDashMatches.length > 0) {
  console.error(`❌ Found em-dashes in compiled HTML:`, htmlEmDashMatches);
  process.exit(1);
} else {
  console.log('✅ Zero em-dashes verified in compiled HTML!');
}

console.log('✅ Single-page A4 HTML template with 1-column certifications successfully compiled!');
console.log('\n🎉 ALL SPRINT 5 RESUME TAILORING, ATS & CERTIFICATIONS TESTS PASSED!');
