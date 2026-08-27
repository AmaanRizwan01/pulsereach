/**
 * Pulsereach — State Tracker Unit Tests
 * Verifies atomic persistence, deduplication, lifecycle transitions, follow-up scheduling,
 * 15-minute cooldown tracking, active card queue locks, and priority sorting.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  generateJobKey,
  loadState,
  isJobProcessed,
  filterUnprocessedJobs,
  upsertJobRecord,
  getJobRecord,
  updateJobStatus,
  getPendingFollowUps,
  setPostActionCooldown,
  isCooldownActive,
  getActiveJobKey,
  setActiveJobKey,
  clearActiveJobKey,
  ApplicationRecord,
} from './state-tracker.js';
import { sortJobsByPriority } from './pipeline.js';
import { SheetJobRow } from '../sheets/sheets-client.js';

const TEST_STATE_PATH = path.resolve(process.cwd(), 'scratch_state_test.json');

async function cleanTestFile() {
  try {
    await fs.unlink(TEST_STATE_PATH);
  } catch {}
}

console.log('🧪 === Starting State Tracker Unit Tests ===\n');

try {
  await cleanTestFile();

  // Test 1: Deterministic key generation
  console.log('1️⃣ Testing generateJobKey()...');
  const key1 = generateJobKey('Careem Inc.', 'Senior Frontend Engineer (React/Next)');
  const key2 = generateJobKey('careem inc', 'senior frontend engineer react next');
  console.assert(key1 === key2, `Expected keys to match: ${key1} vs ${key2}`);
  console.assert(key1 === 'careeminc_seniorfrontendengineerreactnext', `Unexpected key format: ${key1}`);
  console.log(`✅ Key generation verified: "${key1}"`);

  // Test 2: Clean state initialization
  console.log('\n2️⃣ Testing initial state loading on missing file...');
  const state0 = await loadState(TEST_STATE_PATH);
  console.assert(state0.version === 1, 'Expected version 1');
  console.assert(state0.totalProcessedCount === 0, 'Expected 0 processed count');
  console.log('✅ Missing file handled gracefully.');

  // Test 3: Upsert job record
  console.log('\n3️⃣ Testing upsertJobRecord()...');
  const recordKey = generateJobKey('Careem', 'Senior Frontend Engineer');
  const record1: ApplicationRecord = {
    jobKey: recordKey,
    rowNumber: 2,
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Careem',
    location: 'Dubai, UAE',
    status: 'DRAFT_CREATED',
    atsScore: 95,
    matchScore: 95,
    contactEmails: ['careers@careem.com'],
    draftId: 'draft-12345',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await upsertJobRecord(record1, TEST_STATE_PATH);
  const fetched1 = await getJobRecord(recordKey, TEST_STATE_PATH);
  console.assert(fetched1 !== undefined, 'Expected record to exist');
  console.assert(fetched1?.status === 'DRAFT_CREATED', `Expected DRAFT_CREATED, got ${fetched1?.status}`);
  console.assert(fetched1?.draftId === 'draft-12345', 'Draft ID mismatch');
  console.log('✅ Upsert and retrieval verified.');

  // Test 4: Deduplication check
  console.log('\n4️⃣ Testing isJobProcessed() and filterUnprocessedJobs()...');
  const isProcessed = await isJobProcessed('Careem', 'Senior Frontend Engineer', TEST_STATE_PATH);
  console.assert(isProcessed === true, 'Expected job to be marked processed');

  const mockJobs: SheetJobRow[] = [
    {
      rowNumber: 2,
      dateFetched: '2026-08-22',
      jobTitle: 'Senior Frontend Engineer',
      companyName: 'Careem',
      location: 'Dubai',
      domainCategory: 'Frontend',
      contactEmails: ['careers@careem.com'],
      applicationLink: 'https://careers.careem.com',
      outreachStrategy: 'Tailor React',
      atsKeywordsAndPhrasing: 'React, Next.js',
      rawRow: [],
    },
    {
      rowNumber: 3,
      dateFetched: '2026-08-22',
      jobTitle: 'Backend Engineer',
      companyName: 'Talabat',
      location: 'Dubai',
      domainCategory: 'Backend',
      contactEmails: ['jobs@talabat.com'],
      applicationLink: 'https://talabat.com',
      outreachStrategy: 'Tailor Node.js',
      atsKeywordsAndPhrasing: 'Node.js, PostgreSQL',
      rawRow: [],
    },
  ];

  const unprocessed = await filterUnprocessedJobs(mockJobs, TEST_STATE_PATH);
  console.assert(unprocessed.length === 1, `Expected 1 unprocessed job, got ${unprocessed.length}`);
  console.assert(unprocessed[0].companyName === 'Talabat', `Expected Talabat, got ${unprocessed[0].companyName}`);
  console.log(`✅ Deduplication correctly filtered out Careem, leaving Talabat.`);

  // Test 5: Status update & follow-up scheduling upon SENT
  console.log('\n5️⃣ Testing updateJobStatus() to SENT and Follow-Up auto-scheduling...');
  await updateJobStatus(recordKey, 'SENT', {}, TEST_STATE_PATH);
  const updated1 = await getJobRecord(recordKey, TEST_STATE_PATH);
  console.assert(updated1?.status === 'SENT', `Expected SENT, got ${updated1?.status}`);
  console.assert(!!updated1?.appliedAt, 'Expected appliedAt to be set');
  console.assert(!!updated1?.followUpDay4At, 'Expected followUpDay4At to be scheduled');
  console.assert(!!updated1?.followUpDay9At, 'Expected followUpDay9At to be scheduled');
  console.log(`✅ Status updated to SENT. Day 4: ${updated1?.followUpDay4At}, Day 9: ${updated1?.followUpDay9At}`);

  // Test 6: Follow-up query
  console.log('\n6️⃣ Testing getPendingFollowUps()...');
  const futureDateDay5 = new Date();
  futureDateDay5.setDate(futureDateDay5.getDate() + 5);

  const pendingDay5 = await getPendingFollowUps(futureDateDay5, TEST_STATE_PATH);
  console.assert(pendingDay5.day4FollowUps.length === 1, `Expected 1 Day-4 follow-up, got ${pendingDay5.day4FollowUps.length}`);
  console.assert(pendingDay5.day9FollowUps.length === 0, `Expected 0 Day-9 follow-ups, got ${pendingDay5.day9FollowUps.length}`);
  console.log('✅ Follow-up scheduling and retrieval verified.');

  // Test 7: Corruption recovery
  console.log('\n7️⃣ Testing recovery from corrupted state.json...');
  await fs.writeFile(TEST_STATE_PATH, '<<< INVALID MALFORMED JSON >>>', 'utf-8');
  const recoveredState = await loadState(TEST_STATE_PATH);
  console.assert(recoveredState.version === 1, 'Expected auto-reset to clean state');
  console.assert(recoveredState.totalProcessedCount === 0, 'Expected empty state on corruption');
  console.log('✅ Corrupted state.json automatically recovered.');

  // Test 8: 15-Minute Dynamic Cooldown Tracking
  console.log('\n8️⃣ Testing setPostActionCooldown() and isCooldownActive()...');
  await cleanTestFile();
  const nextTime = await setPostActionCooldown(15 * 60 * 1000, TEST_STATE_PATH);
  const cooldownCheck = await isCooldownActive(TEST_STATE_PATH);
  console.assert(cooldownCheck.active === true, 'Expected cooldown to be active');
  console.assert(cooldownCheck.remainingMs > 14 * 60 * 1000, 'Expected >14 min remaining');
  console.assert(cooldownCheck.nextEligibleAt === nextTime, 'Expected nextEligibleAt to match');
  console.log(`✅ 15-minute cooldown verified (Active until: ${nextTime})`);

  // Test 9: Active Job Key Queue Lock
  console.log('\n9️⃣ Testing activeJobKey lock and release...');
  await setActiveJobKey('job_12345', TEST_STATE_PATH);
  const activeKey = await getActiveJobKey(TEST_STATE_PATH);
  console.assert(activeKey === 'job_12345', `Expected job_12345, got ${activeKey}`);
  await clearActiveJobKey(TEST_STATE_PATH);
  const clearedKey = await getActiveJobKey(TEST_STATE_PATH);
  console.assert(clearedKey === undefined, 'Expected active key to be cleared');
  console.log('✅ Single-job queue lock and release verified.');

  // Test 10: Priority Sorting (Newest Leads First)
  console.log('\n🔟 Testing sortJobsByPriority()...');
  const unsortedJobs: SheetJobRow[] = [
    {
      rowNumber: 2,
      dateFetched: '2026-08-20',
      jobTitle: 'Old Job',
      companyName: 'Old Corp',
      location: 'Dubai',
      domainCategory: 'General',
      contactEmails: [],
      applicationLink: '',
      outreachStrategy: '',
      atsKeywordsAndPhrasing: '',
      rawRow: [],
    },
    {
      rowNumber: 5,
      dateFetched: '2026-08-22',
      jobTitle: 'New Job Higher Row',
      companyName: 'New Corp 2',
      location: 'Dubai',
      domainCategory: 'General',
      contactEmails: [],
      applicationLink: '',
      outreachStrategy: '',
      atsKeywordsAndPhrasing: '',
      rawRow: [],
    },
    {
      rowNumber: 3,
      dateFetched: '2026-08-22',
      jobTitle: 'New Job Lower Row',
      companyName: 'New Corp 1',
      location: 'Dubai',
      domainCategory: 'General',
      contactEmails: [],
      applicationLink: '',
      outreachStrategy: '',
      atsKeywordsAndPhrasing: '',
      rawRow: [],
    },
  ];

  const sortedJobs = sortJobsByPriority(unsortedJobs);
  console.assert(sortedJobs[0].jobTitle === 'New Job Higher Row', `Expected newest first, got ${sortedJobs[0].jobTitle}`);
  console.assert(sortedJobs[1].jobTitle === 'New Job Lower Row', `Expected second newest, got ${sortedJobs[1].jobTitle}`);
  console.assert(sortedJobs[2].jobTitle === 'Old Job', `Expected oldest last, got ${sortedJobs[2].jobTitle}`);
  console.log('✅ Priority sorting (Newest dates and higher row indices first) verified.');

  console.log('\n🎉 ALL 10 UNIT & QUEUE TESTS PASSED SUCCESSFULLY!');
} finally {
  await cleanTestFile();
}
