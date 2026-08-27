/**
 * Pulsereach — Dashboard Status Polling API Route (Vercel Serverless)
 * Checks Google Drive for the results JSON file uploaded by the GitHub Actions worker.
 * Each poll takes ~2-3s (one Drive API call), well within Vercel Hobby 10s limit.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getEnv } from '../../src/config/env.js';

/**
 * Creates an authenticated Google Drive client using the storage account credentials.
 */
function getDriveClient() {
  const env = getEnv();
  const clientId = env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_STORAGE_REFRESH_TOKEN || env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth2 credentials for Drive access.');
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth: auth as any });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for dashboard frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const jobId = (req.query.id as string || '').trim();
  if (!jobId || !jobId.startsWith('dash-')) {
    return res.status(400).json({ error: 'Missing or invalid job ID. Expected format: dash-{timestamp}' });
  }

  try {
    const drive = getDriveClient();
    const fileName = `results-${jobId}.json`;

    // Search for the results file in Google Drive
    // The worker uploads to "Pulsereach Applications/Dashboard Results/" folder
    const searchRes = await drive.files.list({
      q: `name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      spaces: 'drive',
      pageSize: 1,
    });

    const file = searchRes.data.files?.[0];

    if (!file || !file.id) {
      return res.status(200).json({
        jobId,
        status: 'PROCESSING',
        message: 'Generation in progress. Please continue polling.',
      });
    }

    // File found — download and parse the results JSON
    const fileRes = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );

    let results: any;
    try {
      results = typeof fileRes.data === 'string'
        ? JSON.parse(fileRes.data)
        : fileRes.data;
    } catch {
      return res.status(200).json({
        jobId,
        status: 'PROCESSING',
        message: 'Results file found but not yet complete.',
      });
    }

    // Return the full results
    return res.status(200).json({
      jobId,
      ...results,
    });
  } catch (err: any) {
    console.error(`[Dashboard Status] Error polling for job ${jobId}:`, err.message);
    return res.status(500).json({
      error: 'Failed to check generation status.',
      details: err.message,
    });
  }
}
