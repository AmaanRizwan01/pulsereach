/**
 * Pulsereach — Application State Tracker & Deduplication Engine
 * Manages persistent state with atomic disk writes (state.json), job deduplication,
 * follow-up scheduling, and dynamic 15-minute queue cooldown tracking.
 */

import fs from 'fs/promises';
import path from 'path';
import { SheetJobRow } from '../sheets/sheets-client.js';

export type JobApplicationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DRAFT_CREATED'
  | 'APPROVED'
  | 'SENT'
  | 'SKIPPED'
  | 'NOT_RELEVANT'
  | 'FOLLOWUP_DAY4_DRAFTED'
  | 'FOLLOWUP_DAY4_SENT'
  | 'FOLLOWUP_DAY9_DRAFTED'
  | 'FOLLOWUP_DAY9_SENT'
  | 'CANCELLED_REPLY_RECEIVED'
  | 'FAILED';

export interface ApplicationRecord {
  jobKey: string;
  rowNumber: number;
  jobTitle: string;
  companyName: string;
  location: string;
  status: JobApplicationStatus;
  atsScore?: number;
  matchScore?: number;
  selectedProjects?: string[];
  contactEmails: string[];
  recruiterLinkedIn?: string;
  applicationLink?: string;
  draftId?: string;
  telegramMessageId?: number;
  resumeDriveUrl?: string;
  coverLetterDriveUrl?: string;
  appliedAt?: string;
  followUpDay4At?: string;
  followUpDay9At?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StateStore {
  version: number;
  lastSyncTime: string;
  totalProcessedCount: number;
  /** Key of the single job currently pending review on Telegram */
  activeJobKey?: string;
  /** ISO timestamp of the last user approval/send/skip action */
  lastActionTimestamp?: string;
  /** ISO timestamp indicating when the next job can be generated & delivered (T + 15m) */
  nextEligibleDispatchAt?: string;
  applications: Record<string, ApplicationRecord>;
}

const DEFAULT_STATE_PATH = process.env.VERCEL
  ? path.resolve('/tmp', 'state.json')
  : path.resolve(process.cwd(), 'state.json');

/**
 * Normalizes company name and job title into a deterministic deduplication key.
 * e.g., "Careem Inc." + "Senior Frontend Engineer" -> "careem_seniorfrontendengineer"
 */
export function generateJobKey(companyName: string, jobTitle: string): string {
  const cleanCompany = (companyName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const cleanTitle = (jobTitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${cleanCompany}_${cleanTitle}`;
}

/**
 * Creates a clean default state structure.
 */
function createDefaultState(): StateStore {
  return {
    version: 1,
    lastSyncTime: new Date().toISOString(),
    totalProcessedCount: 0,
    applications: {},
  };
}

/**
 * Loads the current state from disk. Recovers gracefully if file is missing or corrupted.
 */
export async function loadState(filePath: string = DEFAULT_STATE_PATH): Promise<StateStore> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StateStore;
    if (!parsed.applications || typeof parsed.applications !== 'object') {
      return createDefaultState();
    }
    return parsed;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // File does not exist yet; create and return clean state
      const defaultState = createDefaultState();
      await saveState(defaultState, filePath);
      return defaultState;
    }

    console.warn(`[StateTracker] Failed to parse state file (${err.message}), resetting to clean state.`);
    const recoveredState = createDefaultState();
    await saveState(recoveredState, filePath);
    return recoveredState;
  }
}

/**
 * Saves the state atomically to disk using a temporary file and rename.
 */
export async function saveState(
  state: StateStore,
  filePath: string = DEFAULT_STATE_PATH
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  state.lastSyncTime = new Date().toISOString();
  state.totalProcessedCount = Object.keys(state.applications).length;
  const serialized = JSON.stringify(state, null, 2);

  await fs.writeFile(tempPath, serialized, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Checks whether a job has already been processed or drafted.
 */
export async function isJobProcessed(
  companyName: string,
  jobTitle: string,
  filePath: string = DEFAULT_STATE_PATH
): Promise<boolean> {
  const state = await loadState(filePath);
  const key = generateJobKey(companyName, jobTitle);
  const record = state.applications[key];

  if (!record) return false;

  // These statuses indicate the job is already handled
  const terminalStatuses: JobApplicationStatus[] = [
    'DRAFT_CREATED',
    'APPROVED',
    'SENT',
    'SKIPPED',
    'NOT_RELEVANT',
    'FOLLOWUP_DAY4_DRAFTED',
    'FOLLOWUP_DAY4_SENT',
    'FOLLOWUP_DAY9_DRAFTED',
    'FOLLOWUP_DAY9_SENT',
  ];

  return terminalStatuses.includes(record.status);
}

/**
 * Detects if there is already an active job lead awaiting candidate review in Google Sheets.
 * Prevents spinning up redundant worker executions when a lead is already active in Telegram.
 * Ignores stale pending jobs older than 60 minutes so broken or abandoned states do not permanently lock the pipeline.
 */
export function getActivePendingJobFromSheet(
  jobs: SheetJobRow[],
  options?: { ignoreRowNumbers?: number[] }
): SheetJobRow | null {
  const now = Date.now();
  const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

  for (const job of jobs) {
    if (options?.ignoreRowNumbers && options.ignoreRowNumbers.includes(job.rowNumber)) {
      continue;
    }

    if (job.status) {
      const lower = job.status.toLowerCase();
      if (
        (lower.includes('draft created') || lower.includes('portal lead') || lower.includes('pending review')) &&
        !lower.includes('applied') &&
        !lower.includes('skipped') &&
        !lower.includes('not relevant')
      ) {
        // Staleness guard: if Column L (appliedAt) has a timestamp, check if it's over 60 mins old
        if (job.appliedAt) {
          const statusTimestamp = Date.parse(job.appliedAt);
          if (!isNaN(statusTimestamp) && (now - statusTimestamp) > STALE_THRESHOLD_MS) {
            continue; // Stale lead; ignore and do not lock the pipeline
          }
        }
        return job;
      }
    }
  }
  return null;
}

/**
 * Filters a list of Google Sheet rows to only include unprocessed jobs.
 * Enforces zero-job-left-behind: only skips jobs that have already been finalized
 * in state.json or marked as terminal/pending in the spreadsheet.
 */
export async function filterUnprocessedJobs(
  jobs: SheetJobRow[],
  filePath: string = DEFAULT_STATE_PATH
): Promise<SheetJobRow[]> {
  const state = await loadState(filePath);
  return jobs.filter((job) => {
    // 1. Check if row status in Google Sheet is already marked terminal or pending
    if (job.status) {
      const lowerStatus = job.status.toLowerCase();
      if (
        lowerStatus.includes('applied') ||
        lowerStatus.includes('draft created') ||
        lowerStatus.includes('portal lead') ||
        lowerStatus.includes('pending') ||
        lowerStatus.includes('skipped') ||
        lowerStatus.includes('not relevant')
      ) {
        return false;
      }
    }

    // 2. Check persistent state tracker (state.json)
    const key = generateJobKey(job.companyName, job.jobTitle);
    const record = state.applications[key];
    if (!record) return true;

    // Reprocess only if explicitly in PENDING or FAILED state
    return record.status === 'PENDING' || record.status === 'FAILED';
  });
}

/**
 * Inserts or updates an application record in the state store.
 */
export async function upsertJobRecord(
  record: ApplicationRecord,
  filePath: string = DEFAULT_STATE_PATH
): Promise<void> {
  const state = await loadState(filePath);
  const now = new Date().toISOString();

  const existing = state.applications[record.jobKey];
  state.applications[record.jobKey] = {
    ...existing,
    ...record,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await saveState(state, filePath);
}

/**
 * Retrieves a single application record by its job key, prefix, or active state.
 */
export async function getJobRecord(
  jobKey: string,
  filePath: string = DEFAULT_STATE_PATH
): Promise<ApplicationRecord | undefined> {
  const state = await loadState(filePath);
  if (state.applications[jobKey]) {
    return state.applications[jobKey];
  }
  // Fallback: match by prefix (for truncated Telegram callback keys)
  return Object.values(state.applications).find(
    (app) => app.jobKey.startsWith(jobKey) || (state.activeJobKey && app.jobKey === state.activeJobKey)
  );
}

/**
 * Updates the status and optional fields of an existing application.
 */
export async function updateJobStatus(
  jobKey: string,
  status: JobApplicationStatus,
  extra?: Partial<ApplicationRecord>,
  filePath: string = DEFAULT_STATE_PATH
): Promise<void> {
  const state = await loadState(filePath);
  let resolvedKey = jobKey;
  let existing = state.applications[jobKey];

  if (!existing) {
    const found = Object.values(state.applications).find(
      (app) => app.jobKey.startsWith(jobKey) || (state.activeJobKey && app.jobKey === state.activeJobKey)
    );
    if (found) {
      resolvedKey = found.jobKey;
      existing = found;
    }
  }

  const now = new Date().toISOString();
  if (!existing) {
    state.applications[resolvedKey] = {
      jobKey: resolvedKey,
      rowNumber: extra?.rowNumber || 0,
      jobTitle: extra?.jobTitle || 'Job Title',
      companyName: extra?.companyName || 'Target Company',
      location: extra?.location || 'UAE',
      status,
      contactEmails: extra?.contactEmails || [],
      createdAt: now,
      updatedAt: now,
      ...extra,
    };
    await saveState(state, filePath);
    return;
  }
  state.applications[resolvedKey] = {
    ...existing,
    ...extra,
    status,
    updatedAt: now,
  };

  if (status === 'SENT' && !state.applications[jobKey].appliedAt) {
    state.applications[jobKey].appliedAt = now;
    // Set follow-up scheduled dates (Day 4 and Day 9)
    const appliedDate = new Date(now);
    const day4 = new Date(appliedDate);
    day4.setDate(day4.getDate() + 4);
    const day9 = new Date(appliedDate);
    day9.setDate(day9.getDate() + 9);

    state.applications[jobKey].followUpDay4At = day4.toISOString();
    state.applications[jobKey].followUpDay9At = day9.toISOString();
  }

  await saveState(state, filePath);
}

/**
 * Marks a job application as approved and sent.
 */
export async function approveJobApplication(jobKey: string, filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  await updateJobStatus(jobKey, 'SENT', {}, filePath);
}

/**
 * Marks a job application as skipped by candidate.
 */
export async function skipJobApplication(jobKey: string, filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  await updateJobStatus(jobKey, 'SKIPPED', {}, filePath);
}

/**
 * Marks a job listing as not relevant.
 */
export async function markJobNotRelevant(jobKey: string, filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  await updateJobStatus(jobKey, 'NOT_RELEVANT', {}, filePath);
}

/**
 * Sets the post-action cooldown timer (default 15 minutes = 900,000 ms).
 * Clears activeJobKey so the next job is unlocked once the cooldown completes.
 */
export async function setPostActionCooldown(
  durationMs: number = 15 * 60 * 1000,
  filePath: string = DEFAULT_STATE_PATH
): Promise<string> {
  const state = await loadState(filePath);
  const now = new Date();
  const nextTime = new Date(now.getTime() + durationMs);

  state.lastActionTimestamp = now.toISOString();
  state.nextEligibleDispatchAt = nextTime.toISOString();
  state.activeJobKey = undefined;

  await saveState(state, filePath);
  return state.nextEligibleDispatchAt;
}

/**
 * Checks if the cooldown timer is currently active.
 */
export async function isCooldownActive(filePath: string = DEFAULT_STATE_PATH): Promise<{
  active: boolean;
  remainingMs: number;
  nextEligibleAt?: string;
}> {
  const state = await loadState(filePath);
  if (!state.nextEligibleDispatchAt) {
    return { active: false, remainingMs: 0 };
  }

  const nextTime = new Date(state.nextEligibleDispatchAt).getTime();
  const now = Date.now();
  const diff = nextTime - now;

  if (diff > 0) {
    return { active: true, remainingMs: diff, nextEligibleAt: state.nextEligibleDispatchAt };
  }

  return { active: false, remainingMs: 0, nextEligibleAt: state.nextEligibleDispatchAt };
}

/**
 * Gets the current active job key waiting for review in Telegram.
 */
export async function getActiveJobKey(filePath: string = DEFAULT_STATE_PATH): Promise<string | undefined> {
  const state = await loadState(filePath);
  return state.activeJobKey;
}

/**
 * Sets the active job key waiting for review in Telegram.
 */
export async function setActiveJobKey(jobKey: string, filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  const state = await loadState(filePath);
  state.activeJobKey = jobKey;
  await saveState(state, filePath);
}

/**
 * Clears the active job key from state.
 */
export async function clearActiveJobKey(filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  const state = await loadState(filePath);
  state.activeJobKey = undefined;
  await saveState(state, filePath);
}

/**
 * Clears all queue locks and cooldown timers in a single atomic write.
 * Used by the /reset Telegram command to recover from stuck states.
 */
export async function clearAllLocks(filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  const state = await loadState(filePath);
  state.activeJobKey = undefined;
  state.nextEligibleDispatchAt = undefined;
  state.lastActionTimestamp = undefined;
  await saveState(state, filePath);
}

/**
 * Retrieves applications eligible for Day 4 or Day 9 follow-up outreach.
 */
export async function getPendingFollowUps(
  currentDate: Date = new Date(),
  filePath: string = DEFAULT_STATE_PATH
): Promise<{
  day4FollowUps: ApplicationRecord[];
  day9FollowUps: ApplicationRecord[];
  }> {
  const state = await loadState(filePath);
  const now = currentDate.getTime();

  const day4FollowUps: ApplicationRecord[] = [];
  const day9FollowUps: ApplicationRecord[] = [];

  for (const app of Object.values(state.applications)) {
    if (app.status === 'SENT' && app.followUpDay4At) {
      if (new Date(app.followUpDay4At).getTime() <= now) {
        day4FollowUps.push(app);
      }
    } else if (app.status === 'FOLLOWUP_DAY4_SENT' && app.followUpDay9At) {
      if (new Date(app.followUpDay9At).getTime() <= now) {
        day9FollowUps.push(app);
      }
    }
  }

  return { day4FollowUps, day9FollowUps };
}

/**
 * Resets the state store (useful for testing and migrations).
 */
export async function resetState(filePath: string = DEFAULT_STATE_PATH): Promise<void> {
  const defaultState = createDefaultState();
  await saveState(defaultState, filePath);
}
