import { parseContactEmails, parseSheetRow } from './sheets-client.js';

console.log('=== Test 1: Testing Multi-Email Contact Parsing with "Email Not Found" ===');

const emailTestCases = [
  {
    input: 'hr@techcorp.ae, recruitment@techcorp.ae',
    expected: ['hr@techcorp.ae', 'recruitment@techcorp.ae'],
  },
  {
    input: 'Sarah Jenkins <s.jenkins@emiratesgroup.com>; careers@emiratesgroup.com',
    expected: ['s.jenkins@emiratesgroup.com', 'careers@emiratesgroup.com'],
  },
  {
    input: 'Email Not Found',
    expected: [],
  },
  {
    input: 'careers@dubizzle.com, talent@bayut.com',
    expected: ['careers@dubizzle.com', 'talent@bayut.com'],
  },
  {
    input: 'invalid-email, not_an_email@, @nodomain.com, clean@verified.ae',
    expected: ['clean@verified.ae'],
  },
  {
    input: '',
    expected: [],
  },
];

for (const [idx, tc] of emailTestCases.entries()) {
  const result = parseContactEmails(tc.input);
  console.log(`Case ${idx + 1}:`);
  console.log(`  Input:    "${tc.input.replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`);
  console.log(`  Output:   ${JSON.stringify(result)}`);
  const match = JSON.stringify(result.sort()) === JSON.stringify(tc.expected.sort());
  if (!match) {
    console.error(`  ❌ Failed: expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(result)}`);
    process.exit(1);
  } else {
    console.log(`  ✅ Passed`);
  }
}

console.log('\n=== Test 2: Testing 10-Column Sheet Row Parsing (ATOM Technologies - Email Not Found) ===');

const atomRow = [
  '2026-08-23 03:54 AM GST',
  'Full Stack Product Engineer',
  'ATOM Technologies Limited',
  'Dubai, UAE (DIFC Innovation Hub)',
  'InsurTech & Full Stack Web',
  'Email Not Found',
  '[https://www.linkedin.com/company/atom-technologies-ltd/](https://www.linkedin.com/company/atom-technologies-ltd/)',
  '[https://apply.workable.com/atom-technologies-limited/j/9A363081AB](https://apply.workable.com/atom-technologies-limited/j/9A363081AB)',
  'Subject: Application: Full Stack Product Engineer - Candidate Name. Pitch: Specialize in building end-to-end full stack solutions with React, Node.js (NestJS), and AWS Aurora PostgreSQL.',
  'Keywords: React.js, TypeScript, Node.js, NestJS, AWS, PostgreSQL, Prisma, RESTful APIs.',
];

const parsedAtom = parseSheetRow(atomRow, 0);
console.log('Parsed ATOM Row:');
console.log(JSON.stringify(parsedAtom, null, 2));

if (
  parsedAtom &&
  parsedAtom.rowNumber === 2 &&
  parsedAtom.jobTitle === 'Full Stack Product Engineer' &&
  parsedAtom.companyName === 'ATOM Technologies Limited' &&
  parsedAtom.contactEmails.length === 0 &&
  parsedAtom.recruiterLinkedIn === 'https://www.linkedin.com/company/atom-technologies-ltd/' &&
  parsedAtom.applicationLink === 'https://apply.workable.com/atom-technologies-limited/j/9A363081AB'
) {
  console.log('✅ ATOM row correctly parsed (Email Not Found -> 0 emails, Clean LinkedIn & Portal URLs)');
} else {
  console.error('❌ ATOM row parsing failed');
  process.exit(1);
}

console.log('\n=== Test 3: Testing 10-Column Sheet Row Parsing (Bayut | dubizzle - 2 Emails) ===');

const bayutRow = [
  '2026-08-23 03:54 AM GST',
  'Machine Learning - Intern',
  'Bayut | dubizzle',
  'Dubai, UAE (Dubai Design District)',
  'Data Science & Machine Learning',
  'careers@dubizzle.com, talent@bayut.com',
  '[https://www.linkedin.com/company/bayut-com/](https://www.linkedin.com/company/bayut-com/)',
  '[https://apply.workable.com/bayutdubizzle/j/1876E6B7D8/](https://apply.workable.com/bayutdubizzle/j/1876E6B7D8/)',
  'Subject: Application: Machine Learning Intern - Candidate Name.',
  'Keywords: Machine Learning, Python, SQL, Statistical Modeling.',
];

const parsedBayut = parseSheetRow(bayutRow, 1);
if (
  parsedBayut &&
  parsedBayut.rowNumber === 3 &&
  parsedBayut.jobTitle === 'Machine Learning - Intern' &&
  parsedBayut.companyName === 'Bayut | dubizzle' &&
  parsedBayut.contactEmails.length === 2 &&
  parsedBayut.recruiterLinkedIn === 'https://www.linkedin.com/company/bayut-com/' &&
  parsedBayut.applicationLink === 'https://apply.workable.com/bayutdubizzle/j/1876E6B7D8/'
) {
  console.log('✅ Bayut row correctly parsed (2 emails, Clean LinkedIn & Portal URLs, rowNumber = 3)');
} else {
  console.error('❌ Bayut row parsing failed');
  process.exit(1);
}

console.log('\n🎉 ALL SHEETS CLIENT TESTS PASSED!');
