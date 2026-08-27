/**
 * Pulsereach — Candidate Profile Seeder
 * Reads profile.json from root and upserts it into the Supabase candidate_profiles table.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { CandidateMasterProfile } from './types.js';

dotenv.config();

async function seedProfile() {
  console.log('🚀 [Profile Seeder] Starting profile sync to Supabase...');

  const profilePath = path.resolve(process.cwd(), 'profile.json');
  const examplePath = path.resolve(process.cwd(), 'profile.example.json');

  let targetPath = profilePath;
  if (!fs.existsSync(profilePath)) {
    if (fs.existsSync(examplePath)) {
      console.warn('⚠️ profile.json not found. Using profile.example.json as seed source.');
      targetPath = examplePath;
    } else {
      console.error('❌ Error: Neither profile.json nor profile.example.json found.');
      process.exit(1);
    }
  }

  const rawContent = fs.readFileSync(targetPath, 'utf-8');
  let profile: CandidateMasterProfile;

  try {
    profile = JSON.parse(rawContent);
  } catch (err: any) {
    console.error(`❌ Failed to parse JSON at ${targetPath}: ${err.message}`);
    process.exit(1);
  }

  if (!profile.name || !profile.email) {
    console.error('❌ Profile must contain at least "name" and "email" fields.');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const payload = {
    name: profile.name,
    visa_status: profile.visaStatus || '',
    phone: profile.phone || '',
    email: profile.email,
    linkedin_url: profile.linkedinUrl || '',
    github_url: profile.githubUrl || '',
    portfolio_url: profile.portfolioUrl || '',
    default_headline: profile.defaultHeadline || '',
    default_summary: profile.defaultSummary || '',
    skills: profile.skills || {},
    experience: profile.experience || [],
    projects: profile.projects || {},
    education: profile.education || [],
    certifications: profile.certifications || [],
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/candidate_profiles`;
  console.log(`📡 Connecting to Supabase at: ${supabaseUrl}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`❌ Supabase upload failed with status ${response.status}: ${errBody}`);
      process.exit(1);
    }

    console.log(`✅ Successfully seeded profile for "${profile.name}" to Supabase!`);
    console.log(`   • Email: ${profile.email}`);
    console.log(`   • Skills Categories: ${Object.keys(profile.skills || {}).length}`);
    console.log(`   • Verified Projects: ${Object.keys(profile.projects || {}).length}`);
    console.log(`   • Experience Entries: ${(profile.experience || []).length}`);
  } catch (err: any) {
    console.error(`❌ Network error while seeding profile: ${err.message}`);
    process.exit(1);
  }
}

seedProfile().catch((err) => {
  console.error('Fatal seeder error:', err);
  process.exit(1);
});
