/**
 * Pulsereach — Job-to-Candidate Match Evaluator
 * Evaluates candidate qualifications against target job descriptions with fit scoring and decision logic.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';
import { getProfile, getCachedProfile } from '../profile/profile-loader.js';
import { getAllSkills } from './candidate-data.js';

export interface EvaluateMatchOptions {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  minScoreThreshold?: number;
}

export interface MatchEvaluationResult {
  matchScore: number;
  shouldApply: boolean;
  keyStrengths: string[];
  missingRequirements: string[];
  recommendedOutreachAngle: string;
  rationale: string;
}

/**
 * Computes a multi-dimensional match score between the candidate profile and a target job opening.
 */
export async function evaluateJobMatch(
  options: EvaluateMatchOptions
): Promise<MatchEvaluationResult> {
  const profile = await getProfile();
  const allSkills = getAllSkills();
  const { jobTitle, companyName, jobDescription, minScoreThreshold = 65 } = options;

  const educationSummary = (profile.education || [])
    .map((e) => `${e.degree} (${e.institution}${e.grade ? `, ${e.grade}` : ''})`)
    .join(', ');

  const projectSummary = Object.values(profile.projects || {})
    .map((p) => `${p.name} (${p.technologies})`)
    .join('; ');

  const systemInstruction = `You are an elite technical recruiter and matching analyst.
Evaluate the candidate's alignment for the target software engineering position.

CANDIDATE PROFILE:
- Name: ${profile.name}
- Headline: ${profile.defaultHeadline}
- Location & Status: ${profile.visaStatus}
- Education: ${educationSummary || 'Verified Software Engineering Credentials'}
- Verified Skills (${allSkills.length}): ${allSkills.join(', ')}
- Verified Projects: ${projectSummary || 'Production engineering projects'}

CRITICAL HARD RULES:
1. ZERO EM-DASHES: NEVER use em-dashes (— or --).
2. SCORING SCALE: 0 to 100.
   - >= 80: High match (strong overlap with primary stack).
   - 65-79: Medium match (transferable skills or partial stack overlap).
   - < 65: Low match (major hard requirements missing e.g. 5+ yrs C++ or iOS Swift required).
3. Set shouldApply = true if matchScore >= ${minScoreThreshold}.`;

  const prompt = `TARGET OPENING:
Company: ${companyName}
Role: ${jobTitle}
Description:
${jobDescription.slice(0, 6000)}

Evaluate candidate fit and return structured match JSON.`;

  const schema = {
    type: 'object',
    properties: {
      matchScore: { type: 'number', description: 'Integer score from 0 to 100' },
      shouldApply: { type: 'boolean' },
      keyStrengths: { type: 'array', items: { type: 'string' } },
      missingRequirements: { type: 'array', items: { type: 'string' } },
      recommendedOutreachAngle: { type: 'string', description: 'Strategic angle for outreach in under 20 words' },
      rationale: { type: 'string', description: 'Brief explanation of score in under 30 words' },
    },
    required: [
      'matchScore',
      'shouldApply',
      'keyStrengths',
      'missingRequirements',
      'recommendedOutreachAngle',
      'rationale',
    ],
  };

  const raw = await generateStructuredJson<MatchEvaluationResult>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.1,
  });

  return sanitizeEmDashes(raw);
}
