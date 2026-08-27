/**
 * Pulsereach — Day 4 & Day 9 Automated Follow-Up Email Generator
 * Produces concise, non-intrusive follow-ups referencing prior applications.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';
import { getCachedProfile } from '../profile/profile-loader.js';
import { buildFollowUpPrompt } from '../prompts/index.js';
import { sanitizeSalutation } from './email-generator.js';

export interface GenerateFollowUpOptions {
  jobTitle: string;
  companyName: string;
  originalSubject: string;
  sequenceType: 'day_4' | 'day_9';
  recruiterName?: string;
  contactType?: string;
}

export interface FollowUpEmailResult {
  subject: string;
  salutation: string;
  body: string;
  fullEmailText: string;
  wordCount: number;
}

/**
 * Generates an automated follow-up email adhering to strict word count limits (Day 4: <80w, Day 9: <60w).
 */
export async function generateFollowUpEmail(
  options: GenerateFollowUpOptions
): Promise<FollowUpEmailResult> {
  const profile = getCachedProfile();
  const { jobTitle, companyName, originalSubject, sequenceType, recruiterName, contactType } = options;

  const salutation = sanitizeSalutation(recruiterName, companyName, contactType);

  const { systemInstruction, prompt } = buildFollowUpPrompt({
    candidateName: profile.name,
    companyName,
    jobTitle,
    sequenceType,
    originalSubject,
  });

  const schema = {
    type: 'object',
    properties: {
      body: {
        type: 'string',
        description: sequenceType === 'day_4'
          ? 'Short follow-up body under 80 words re-iterating technical enthusiasm and UAE availability.'
          : 'Clean, respectful final check-in body under 50 words.',
      },
    },
    required: ['body'],
  };

  const raw = await generateStructuredJson<{ body: string }>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.2,
  });

  const body = sanitizeEmDashes(raw.body);
  const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
  const fullEmailText = `${salutation}\n\n${body}\n\nBest regards,\n${profile.name}\n${profile.phone}`;
  const wordCount = body.trim().split(/\s+/).length;

  return {
    subject,
    salutation,
    body,
    fullEmailText,
    wordCount,
  };
}
