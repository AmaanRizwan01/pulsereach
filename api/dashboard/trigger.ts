/**
 * Pulsereach — Dashboard Trigger API Route (Vercel Serverless)
 * Accepts job data from the dashboard UI and triggers the GitHub Actions
 * dashboard-generate.yml workflow via the GitHub REST API.
 * Executes in < 5 seconds, well within Vercel Hobby 10s limit.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEnv } from '../../src/config/env.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for dashboard frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Authenticate request using Supabase Auth JWT or WEBHOOK_SECRET
  const env = getEnv();
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { /* ignore */ }
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const providedSecret = req.headers['x-webhook-secret'] || body?.secret;

  let isAuthorized = false;
  let userEmail = '';

  if (providedSecret && providedSecret === env.WEBHOOK_SECRET) {
    isAuthorized = true;
    userEmail = 'webhook-admin';
  } else if (token) {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://auzypzjttocrurwforfo.supabase.co';
    const supabaseAnonKey =
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1enlwemp0dG9jcnVyd2ZvcmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTU0MzQsImV4cCI6MjEwMjQ5MTQzNH0.9vTMQUqJatYdOctcVAuQAs6L_PUaggiyp6AfHqn9OLU';

    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData?.id && userData?.email) {
          isAuthorized = true;
          userEmail = userData.email;
        }
      }
    } catch (authErr: any) {
      console.warn('[Dashboard Trigger] Supabase JWT verification error:', authErr.message);
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({
      error: 'Unauthorized: Active Supabase session required to trigger generation.',
      hint: 'Please sign in at /login',
    });
  }

  console.log(`[Dashboard Trigger] Authenticated request from: ${userEmail}`);

  // Validate input fields
  const jobTitle = (body?.jobTitle || '').trim();
  const companyName = (body?.companyName || '').trim();
  const jobDescription = (body?.jobDescription || '').trim();

  if (!jobTitle) {
    return res.status(400).json({ error: 'Missing required field: jobTitle' });
  }
  if (!companyName) {
    return res.status(400).json({ error: 'Missing required field: companyName' });
  }
  if (!jobDescription || jobDescription.length < 50) {
    return res.status(400).json({
      error: 'Job description must be at least 50 characters.',
      currentLength: jobDescription.length,
    });
  }

  // Generate a unique job ID
  const jobId = `dash-${Date.now()}`;

  // Trigger GitHub Actions workflow_dispatch
  const githubToken = env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(500).json({
      error: 'Server configuration error: GITHUB_TOKEN not set.',
      hint: 'Add a GitHub PAT with actions:write scope to your Vercel environment variables.',
    });
  }

  const owner = (env as any).GITHUB_OWNER || process.env.GITHUB_OWNER || 'AmaanRizwan01';
  const repo = (env as any).GITHUB_REPO || process.env.GITHUB_REPO || 'pulsereach';
  const workflowFile = 'dashboard-generate.yml';

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            job_id: jobId,
            job_title: jobTitle,
            company_name: companyName,
            // Truncate JD to 65000 chars (GitHub API input limit is 65535)
            job_description: jobDescription.slice(0, 65000),
          },
        }),
      }
    );

    if (!ghResponse.ok) {
      const errorText = await ghResponse.text();
      console.error(`[Dashboard Trigger] GitHub API error (${ghResponse.status}):`, errorText);
      return res.status(502).json({
        error: 'Failed to trigger GitHub Actions workflow.',
        status: ghResponse.status,
        details: errorText,
      });
    }

    console.log(`[Dashboard Trigger] Workflow dispatched successfully. Job ID: ${jobId}`);

    return res.status(200).json({
      jobId,
      status: 'TRIGGERED',
      message: 'Generation workflow dispatched. Poll /api/dashboard/status for results.',
      estimatedTimeSeconds: 90,
    });
  } catch (err: any) {
    console.error('[Dashboard Trigger] Failed to dispatch workflow:', err.message);
    return res.status(500).json({
      error: 'Failed to trigger generation workflow.',
      details: err.message,
    });
  }
}
