/**
 * Pulsereach — Dynamic Candidate Profile Loader
 * Fetches and caches candidate profile from Supabase (or local fallback in development).
 */

import dotenv from 'dotenv';
import { CandidateMasterProfile } from './types.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

let cachedProfile: CandidateMasterProfile | null = null;

/**
 * Maps a Supabase candidate_profiles database row into the typed CandidateMasterProfile interface.
 */
export function mapDbRowToProfile(row: Record<string, any>): CandidateMasterProfile {
  return {
    name: row.name || 'Anonymous Candidate',
    visaStatus: row.visa_status || '',
    phone: row.phone || '',
    email: row.email || '',
    linkedinUrl: row.linkedin_url || '',
    githubUrl: row.github_url || '',
    portfolioUrl: row.portfolio_url || '',
    defaultHeadline: row.default_headline || '',
    defaultSummary: row.default_summary || '',
    skills: row.skills || {
      languages: [],
      frontend: [],
      backend: [],
      cloudDevops: [],
      databases: [],
      tools: [],
    },
    experience: Array.isArray(row.experience) ? row.experience : [],
    projects: typeof row.projects === 'object' && row.projects !== null ? row.projects : {},
    education: Array.isArray(row.education) ? row.education : [],
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
  };
}

/**
 * Synchronously retrieves the cached in-memory candidate profile.
 * If the profile has not been fetched yet, attempts to load from local profile.json or profile.example.json.
 */
export function getCachedProfile(): CandidateMasterProfile {
  if (cachedProfile) {
    return cachedProfile;
  }

  // Fallback 1: Local profile.json (development / local runner)
  const localProfilePath = path.resolve(process.cwd(), 'profile.json');
  if (fs.existsSync(localProfilePath)) {
    try {
      const raw = fs.readFileSync(localProfilePath, 'utf-8');
      cachedProfile = JSON.parse(raw);
      return cachedProfile!;
    } catch {
      // ignore parse error and proceed to next fallback
    }
  }

  // Fallback 2: profile.example.json (template fallback)
  const exampleProfilePath = path.resolve(process.cwd(), 'profile.example.json');
  if (fs.existsSync(exampleProfilePath)) {
    try {
      const raw = fs.readFileSync(exampleProfilePath, 'utf-8');
      cachedProfile = JSON.parse(raw);
      return cachedProfile!;
    } catch {
      // ignore
    }
  }

  throw new Error(
    '❌ No candidate profile available. Please configure Supabase candidate_profiles table or create a local profile.json. See docs/PROFILE_GUIDE.md for details.'
  );
}

/**
 * Asynchronously loads the candidate profile from Supabase with fallback to local profile.json.
 */
export async function getProfile(forceRefresh: boolean = false): Promise<CandidateMasterProfile> {
  if (cachedProfile && !forceRefresh) {
    return cachedProfile;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/candidate_profiles?is_active=eq.true&select=*&order=created_at.desc&limit=1`;
      const response = await fetch(endpoint, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const rows = (await response.json()) as any[];
        if (rows && rows.length > 0) {
          cachedProfile = mapDbRowToProfile(rows[0]);
          return cachedProfile;
        }
      } else {
        console.warn(`[ProfileLoader] Supabase fetch returned status ${response.status}. Falling back to local profile.`);
      }
    } catch (err: any) {
      console.warn(`[ProfileLoader] Unable to fetch from Supabase (${err.message}). Falling back to local profile.`);
    }
  }

  // Fallback to sync local loader
  return getCachedProfile();
}

/**
 * Explicitly sets the active profile in memory (used in testing and seeding).
 */
export function setCachedProfile(profile: CandidateMasterProfile): void {
  cachedProfile = profile;
}

/**
 * Clears the in-memory cached profile.
 */
export function resetProfileCache(): void {
  cachedProfile = null;
}
