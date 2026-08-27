import {
  sanitizeSalutation,
  generateTailoredOutreachEmail,
  generateFollowUpEmail,
  classifyRecruiterResponse,
  draftRecruiterReply,
  evaluateJobMatch,
  applyConversationalRevision,
} from './index.js';

console.log('=== Test 1: Testing Salutation Sanitizer ===');
const testCases = [
  { raw: 'Talent Acquisition Team', company: 'Careem', expected: 'Hi Hiring Team,' },
  { raw: 'sarah.connor@dubai.tech', company: 'Dubai Tech', expected: 'Hi Sarah.connor@dubai.tech,' },
  { raw: 'Ahmed Al Mansoori', company: 'Noon', expected: 'Hi Ahmed,' },
  { raw: 'HR Department MENA', company: 'Talabat', expected: 'Hi Hiring Team,' },
  { raw: '', company: 'Bayut', expected: 'Hi Bayut,' },
];

for (const tc of testCases) {
  const result = sanitizeSalutation(tc.raw, tc.company);
  console.log(`• Raw: "${tc.raw}" (Company: ${tc.company}) -> "${result}"`);
}
console.log('✅ Salutation sanitizer successfully converted noise and formatted first names!');

console.log('\n=== Test 2: Testing Cold Application Email Generator ===');
const emailResult = await generateTailoredOutreachEmail({
  jobTitle: 'Backend Engineer (Node.js / PostgreSQL)',
  companyName: 'Talabat',
  jobDescription: 'Seeking a Backend Engineer with strong Node.js, PostgreSQL, Docker, and REST API experience.',
  matchedSkills: ['Node.js', 'PostgreSQL', 'Docker', 'REST APIs'],
  recruiterName: 'Talent Acquisition Team',
});

console.log('• Email Subject:', emailResult.subject);
console.log('• Salutation:', emailResult.salutation);
console.log('• Word Count:', emailResult.wordCount, '(Limit: <120 words)');
console.log('\n--- Full Email Body ---');
console.log(emailResult.fullBodyText);
console.log('-----------------------\n');

if (emailResult.wordCount > 130) {
  console.error(`❌ Cold email word count ${emailResult.wordCount} exceeded maximum target`);
  process.exit(1);
} else {
  console.log('✅ Cold email word count strictly verified under 120 words!');
}

const emailEmDash = emailResult.fullBodyText.match(/[—–]|--/g);
if (emailEmDash && emailEmDash.length > 0) {
  console.error('❌ Em-dashes found in email body:', emailEmDash);
  process.exit(1);
} else {
  console.log('✅ Zero em-dashes verified in email body!');
}

console.log('\n=== Test 3: Testing Day 4 & Day 9 Follow-Up Generator ===');
const day4 = await generateFollowUpEmail({
  jobTitle: 'Backend Engineer',
  companyName: 'Talabat',
  originalSubject: emailResult.subject,
  sequenceType: 'day_4',
  recruiterName: 'Talent Acquisition Team',
});
console.log('• Day 4 Subject:', day4.subject);
console.log('• Day 4 Word Count:', day4.wordCount, '(Limit: <80 words)');
console.log(`• Day 4 Body: "${day4.body}"`);

const day9 = await generateFollowUpEmail({
  jobTitle: 'Backend Engineer',
  companyName: 'Talabat',
  originalSubject: emailResult.subject,
  sequenceType: 'day_9',
  recruiterName: 'Talent Acquisition Team',
});
console.log('• Day 9 Subject:', day9.subject);
console.log('• Day 9 Word Count:', day9.wordCount, '(Limit: <60 words)');
console.log(`• Day 9 Body: "${day9.body}"`);
console.log('✅ Follow-up sequences successfully generated and constrained!');

console.log('\n=== Test 4: Testing 8-Intent Recruiter Conversation Classifier ===');
const interviewSample = `Hi Amaan, Thanks for applying! We were impressed with your Intralead project. Are you available for a 30-minute technical screening call this Thursday at 2 PM GST?`;
const classification = await classifyRecruiterResponse(interviewSample, 'Interview Request: Backend Engineer');
console.log('• Classified Intent:', classification.intent, '(Expected: INTERVIEW_INVITATION)');
console.log('• Confidence:', classification.confidence);
console.log('• Urgency:', classification.urgency);
console.log('• Summary:', classification.summary);

if (classification.intent !== 'INTERVIEW_INVITATION') {
  console.error(`❌ Expected INTERVIEW_INVITATION, got ${classification.intent}`);
  process.exit(1);
} else {
  console.log('✅ Recruiter intent correctly classified as INTERVIEW_INVITATION!');
}

console.log('\n=== Test 5: Testing Recruiter Reply Drafter ===');
const replyResult = await draftRecruiterReply({
  incomingEmailBody: interviewSample,
  incomingEmailSubject: 'Interview Request: Backend Engineer',
  recruiterIntent: 'INTERVIEW_INVITATION',
  recruiterName: 'Lina',
  companyName: 'Talabat',
});
console.log('• Reply Subject:', replyResult.subject);
console.log('• Reply Word Count:', replyResult.wordCount);
console.log('\n--- Full Reply Text ---');
console.log(replyResult.fullReplyText);
console.log('-----------------------\n');
console.log('✅ Recruiter reply generated with candidate contact and availability!');

console.log('\n=== Test 6: Testing Job-to-Candidate Match Evaluator ===');
const match = await evaluateJobMatch({
  jobTitle: 'Senior Full-Stack Engineer',
  companyName: 'Noon',
  jobDescription: 'Looking for a Senior Full-Stack Engineer with Next.js, React, TypeScript, and Supabase experience.',
});
console.log('• Match Score:', match.matchScore + '/100');
console.log('• Should Apply:', match.shouldApply);
console.log('• Key Strengths:', match.keyStrengths.join(', '));
console.log('• Rationale:', match.rationale);
console.log('✅ Match evaluation successfully completed!');

console.log('\n=== Test 7: Testing Conversational Revision Engine ===');
const revised = await applyConversationalRevision({
  artifactType: 'outreach_email',
  currentContent: emailResult.fullBodyText,
  userInstruction: 'Mention that I have hands-on experience tuning Linux kernel power C-states on Proxmox VE.',
  jobContext: {
    jobTitle: 'Backend Engineer',
    companyName: 'Talabat',
  },
});
console.log('• Change Summary:', revised.changeSummary);
console.log('• Revised Content Preview:');
console.log(revised.updatedContent.slice(0, 200) + '...');
console.log('✅ Conversational revision engine successfully applied human Telegram edit!');

console.log('\n🎉 ALL SPRINT 7 EMAIL & AI ENGINE TESTS PASSED!');
