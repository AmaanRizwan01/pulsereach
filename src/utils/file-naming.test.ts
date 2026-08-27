/**
 * Unit tests for file-naming.ts
 */

import { generateDocumentFileName, extractJobMetadataFromCardText, sanitizeToPascalCase } from './file-naming.js';
import assert from 'assert';

console.log('🧪 === Running File Naming Unit Tests ===\n');

// Test 1: PascalCase Sanitization
console.log('1️⃣ Testing sanitizeToPascalCase()...');
assert.strictEqual(sanitizeToPascalCase('Careem Inc.', 20), 'CareemInc');
assert.strictEqual(sanitizeToPascalCase("Smith's Blades LLC", 20), 'SmithsBladesLLC');
assert.strictEqual(sanitizeToPascalCase('Senior Frontend Engineer (React/Next.js)', 25), 'SeniorFrontendEngineerRea');
console.log('✅ sanitizeToPascalCase verified.');

// Test 2: Standard CV & CL Naming with Candidate Name
console.log('\n2️⃣ Testing standard CV & CL filename generation...');
const cvName = generateDocumentFileName('CV', 'Careem', 'Senior Frontend Engineer', 'Jane Doe');
console.log('• Generated CV Name:', cvName, `(${cvName.length} chars)`);
assert(cvName.startsWith('JaneDoe_CV_Careem_SeniorFrontendEngineer'));
assert(cvName.endsWith('.pdf'));
assert(cvName.length <= 65, `CV filename ${cvName.length} exceeds 65 chars limit`);

const clName = generateDocumentFileName('CoverLetter', 'Careem', 'Senior Frontend Engineer', 'Jane Doe');
console.log('• Generated CL Name:', clName, `(${clName.length} chars)`);
assert(clName.startsWith('JaneDoe_CoverLetter_Careem_SeniorFrontendEngine'));
assert(clName.endsWith('.pdf'));
assert(clName.length <= 65, `CL filename ${clName.length} exceeds 65 chars limit`);
console.log('✅ Standard naming verified.');

// Test 3: Extremely Long Strings (Length Cap Test)
console.log('\n3️⃣ Testing extreme length capping...');
const longCv = generateDocumentFileName(
  'CV',
  'VeryLongEnterpriseCorporationMiddleEastHoldingsLimited',
  'PrincipalEnterpriseDistributedCloudArchitectureLeadEngineer',
  'Alexander The Great'
);
console.log('• Long CV Name:', longCv, `(${longCv.length} chars)`);
assert(longCv.endsWith('.pdf'));
assert(longCv.length <= 65, `Long CV filename ${longCv.length} exceeds 65 chars limit`);

const longCl = generateDocumentFileName(
  'CoverLetter',
  'VeryLongEnterpriseCorporationMiddleEastHoldingsLimited',
  'PrincipalEnterpriseDistributedCloudArchitectureLeadEngineer',
  'Alexander The Great'
);
console.log('• Long CL Name:', longCl, `(${longCl.length} chars)`);
assert(longCl.endsWith('.pdf'));
assert(longCl.length <= 65, `Long CL filename ${longCl.length} exceeds 65 chars limit`);
console.log('✅ Length capping (≤ 65 chars) verified.');

// Test 4: Telegram Card HTML Metadata Extraction
console.log('\n4️⃣ Testing extractJobMetadataFromCardText()...');
const mockCardHtml = `
🚀 <b>Senior Full-Stack Engineer</b> @ <b>Careem Networks</b>
📍 Dubai, UAE | 🎯 ATS Score: <b>92/100</b>
📬 <b>To:</b> <code>recruiter@careem.com</code>
`;
const extracted = extractJobMetadataFromCardText(mockCardHtml);
assert.strictEqual(extracted.jobTitle, 'Senior Full-Stack Engineer');
assert.strictEqual(extracted.companyName, 'Careem Networks');
console.log('• Extracted from card:', extracted);
console.log('✅ Card HTML extraction verified.');

// Test 5: Fallback defaults on missing metadata
console.log('\n5️⃣ Testing fallback on empty inputs...');
const fallbackCv = generateDocumentFileName('CV', undefined, undefined, 'Candidate');
assert.strictEqual(fallbackCv, 'Candidate_CV_Company_SoftwareEngineer.pdf');
console.log('• Fallback CV:', fallbackCv);
console.log('✅ Fallbacks verified.');

console.log('\n🎉 ALL FILE NAMING TESTS PASSED SUCCESSFULLY!');
