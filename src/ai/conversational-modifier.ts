/**
 * Pulsereach — Conversational AI Revision Engine
 * Applies human natural language revision feedback (via Telegram) to resumes, cover letters, and email drafts.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';
import { getProfile, getCachedProfile } from '../profile/profile-loader.js';

export interface ModifyArtifactOptions {
  artifactType: 'resume_summary' | 'resume_bullets' | 'cover_letter' | 'outreach_email';
  currentContent: string;
  userInstruction: string;
  jobContext?: {
    jobTitle: string;
    companyName: string;
  };
}

export interface ModifiedArtifactResult {
  updatedContent: string;
  changeSummary: string;
}

/**
 * Applies human feedback to update an outreach artifact while enforcing truth-anchoring and zero em-dashes.
 */
export async function applyConversationalRevision(
  options: ModifyArtifactOptions
): Promise<ModifiedArtifactResult> {
  const profile = await getProfile();
  const { artifactType, currentContent, userInstruction, jobContext } = options;

  const educationSummary = (profile.education || [])
    .map((e) => `${e.degree} from ${e.institution}`)
    .join(', ');

  const projectSummary = Object.values(profile.projects || {})
    .map((p) => `${p.name} (${p.technologies})`)
    .join(', ');

  const systemInstruction = `You are an elite career artifact editor modifying an outreach document based on direct human feedback.
CANDIDATE GROUND TRUTH:
- Name: ${profile.name}
- Location & Status: ${profile.visaStatus || 'Available immediately'}
- Education: ${educationSummary || 'Verified Software Engineering Degree'}
- Verified Projects: ${projectSummary || 'Production engineering projects'}

CRITICAL HARD RULES:
1. ZERO EM-DASHES: NEVER use em-dashes (— or --).
2. TRUTH-ANCHORING: Never fabricate metrics, employers, or skills outside candidate catalog.
3. Precisely execute the human user's requested edit.`;

  const prompt = `ARTIFACT TYPE: ${artifactType}
${jobContext ? `Target Role: ${jobContext.jobTitle} at ${jobContext.companyName}\n` : ''}

CURRENT CONTENT:
${currentContent}

USER REVISION INSTRUCTION:
"${userInstruction}"

Apply the revision and return the updated content.`;

  const schema = {
    type: 'object',
    properties: {
      updatedContent: { type: 'string', description: 'Complete revised text with requested changes' },
      changeSummary: { type: 'string', description: 'Brief 1-sentence summary of what was adjusted' },
    },
    required: ['updatedContent', 'changeSummary'],
  };

  const raw = await generateStructuredJson<ModifiedArtifactResult>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.2,
  });

  return sanitizeEmDashes(raw);
}
