/**
 * Pulsereach — Contextual Recruiter Reply Drafter
 * Generates tailored candidate replies to recruiter inquiries, interview invites, and screening questions.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';
import { getCachedProfile } from '../profile/profile-loader.js';
import { RecruiterIntent } from './conversation-classifier.js';
import { sanitizeSalutation } from './email-generator.js';

export interface DraftReplyOptions {
  incomingEmailBody: string;
  incomingEmailSubject?: string;
  recruiterIntent: RecruiterIntent;
  recruiterName?: string;
  companyName?: string;
  customInstructions?: string;
}

export interface RecruiterReplyResult {
  subject: string;
  salutation: string;
  body: string;
  fullReplyText: string;
  wordCount: number;
}

/**
 * Drafts an appropriate reply to an incoming recruiter email grounded in candidate truth.
 */
export async function draftRecruiterReply(
  options: DraftReplyOptions
): Promise<RecruiterReplyResult> {
  const profile = getCachedProfile();
  const {
    incomingEmailBody,
    incomingEmailSubject,
    recruiterIntent,
    recruiterName,
    companyName,
    customInstructions,
  } = options;

  const salutation = sanitizeSalutation(recruiterName, companyName);

  const systemInstruction = `You are an elite career consultant drafting a professional reply for ${profile.name} to a recruiter.
CANDIDATE GROUND TRUTH:
- Name: ${profile.name}
- Location & Status: ${profile.visaStatus || 'Available immediately'}
- Phone: ${profile.phone} | Email: ${profile.email}
- Portfolio: ${profile.portfolioUrl} | GitHub: ${profile.githubUrl} | LinkedIn: ${profile.linkedinUrl}
- Core Headline: ${profile.defaultHeadline}

CRITICAL HARD RULES:
1. ZERO EM-DASHES: NEVER use em-dashes (— or --).
2. UNDER 150 WORDS. Professional, direct, polite.
3. If INTERVIEW_INVITATION: Express enthusiasm, confirm flexible availability during target business hours, and provide phone/email.
4. If TECHNICAL_ASSESSMENT: Acknowledge receipt, confirm expected completion timeframe, and express excitement.
5. If SALARY_NOTICE_QUERY: State availability, zero notice period, and readiness to discuss market-competitive compensation.
6. If MORE_INFO_REQUEST: Provide direct links to portfolio (${profile.portfolioUrl}) and GitHub (${profile.githubUrl}).`;

  const prompt = `RECRUITER INTENT: ${recruiterIntent}
${companyName ? `Company: ${companyName}\n` : ''}
${incomingEmailSubject ? `Subject: ${incomingEmailSubject}\n` : ''}
Incoming Email:
${incomingEmailBody.slice(0, 2500)}

${customInstructions ? `Special User Instructions: ${customInstructions}\n` : ''}

Draft the reply.`;

  const schema = {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['subject', 'body'],
  };

  const raw = await generateStructuredJson<{ subject: string; body: string }>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.2,
  });

  const body = sanitizeEmDashes(raw.body);
  const subject = incomingEmailSubject
    ? incomingEmailSubject.startsWith('Re:')
      ? incomingEmailSubject
      : `Re: ${incomingEmailSubject}`
    : `Re: Application Follow-Up - ${profile.name}`;

  const fullReplyText = `${salutation}\n\n${body}\n\nBest regards,\n${profile.name}\n${profile.phone} | ${profile.linkedinUrl}`;
  const wordCount = body.trim().split(/\s+/).length;

  return {
    subject,
    salutation,
    body,
    fullReplyText,
    wordCount,
  };
}
