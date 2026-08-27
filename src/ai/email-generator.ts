/**
 * Pulsereach — Cold Email Outreach Drafter & Salutation Sanitizer
 * Generates concise, high-converting cold emails (<120 words) with salutation noise filtering and attachment hooks.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';
import { getProfile, getCachedProfile } from '../profile/profile-loader.js';
import { buildOutreachEmailPrompt } from '../prompts/index.js';

export interface TailoredEmailResult {
  subject: string;
  salutation: string;
  opening: string;
  valueProposition: string;
  callToAction: string;
  fullBodyText: string;
  wordCount: number;
}

export function removeEmDashes(text: string): string {
  if (!text) return '';
  return text
    .replace(/—/g, ', ')
    .replace(/–/g, '-')
    .replace(/\s*--\s*/g, ', ')
    .replace(/\s+,\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Sanitizes scraped contact names into natural email greetings.
 * Distinguishes between real human first names (e.g. "Sarah") and corporate/department scraper artifacts.
 */
export function sanitizeSalutation(
  rawName?: string,
  companyName?: string,
  contactType?: string
): string {
  if (!rawName || typeof rawName !== 'string') {
    if (contactType === 'recruiter' || contactType === 'hr') return 'Hi Hiring Team,';
    if (contactType === 'head_engineering' || contactType === 'cto' || contactType === 'engineering_manager')
      return 'Hi Engineering Team,';
    return `Hi ${companyName || 'Team'},`;
  }

  const clean = rawName.trim();
  const lower = clean.toLowerCase();

  // Corporate / department / scraper noise blacklist
  const noiseKeywords = [
    'team',
    'department',
    'acquisition',
    'recruitment',
    'recruiter',
    'hiring',
    'leadership',
    'office',
    'solutions',
    'services',
    'academy',
    'group',
    'mena',
    'uae',
    'dubai',
    'plc',
    'ltd',
    'inc',
    'corp',
    'consultancy',
    'training',
    'careers',
    'info',
    'support',
    'contact',
    'head of',
    'director',
    'manager',
    'vp',
    'cto',
    'ceo',
    'talent',
  ];

  const isNoise =
    noiseKeywords.some((kw) => lower.includes(kw)) ||
    clean.includes('\n') ||
    clean.includes('/') ||
    clean.includes('&') ||
    clean.split(/\s+/).length > 3 ||
    clean.length > 30;

  if (isNoise) {
    if (contactType === 'recruiter' || contactType === 'hr') return 'Hi Hiring Team,';
    if (contactType === 'head_engineering' || contactType === 'cto' || contactType === 'engineering_manager')
      return 'Hi Engineering Team,';
    return `Hi ${companyName || 'Team'},`;
  }

  const firstName = clean.split(/\s+/)[0] || clean;
  const formattedFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  return `Hi ${formattedFirst},`;
}

export interface GenerateOutreachEmailOptions {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  matchedSkills?: string[];
  recruiterName?: string;
  contactType?: string;
  outreachStrategy?: string;
  candidateName?: string;
  candidateLocation?: string;
}

/**
 * Generates a tailored cold outreach email strictly under 120 words across 3 short paragraphs.
 */
export async function generateTailoredOutreachEmail(
  options: GenerateOutreachEmailOptions
): Promise<TailoredEmailResult> {
  const profile = await getProfile();
  const candidateName = options.candidateName || profile.name;
  const candidateLocation = options.candidateLocation || profile.visaStatus;

  const {
    jobTitle,
    companyName,
    jobDescription,
    matchedSkills = [],
    recruiterName,
    contactType,
    outreachStrategy = '',
  } = options;

  const salutation = sanitizeSalutation(recruiterName, companyName, contactType);

  const verifiedProjectsSummary = Object.values(profile.projects || {}).map(
    (p) => `- ${p.name} (${p.technologies}): ${p.bullets.slice(0, 2).join(' ')}`
  );

  const { systemInstruction, prompt } = buildOutreachEmailPrompt({
    candidateName,
    candidateLocation,
    candidateSkills: matchedSkills.length > 0 ? matchedSkills : ['TypeScript', 'Next.js', 'PostgreSQL', 'Docker', 'Linux Administration'],
    candidateVerifiedProjects: verifiedProjectsSummary,
    companyName,
    jobTitle,
    jobDescription,
    contactName: recruiterName,
    contactType,
    outreachStrategy,
  });

  const schema = {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Clean, direct subject line' },
      opening: { type: 'string', description: 'Paragraph 1: Role hook mentioning interest in the position at the company and UAE Residence Visa status / immediate availability.' },
      valueProposition: { type: 'string', description: 'Paragraph 2: Highly relevant technical capabilities and concrete production experience specifically matching this company and job description.' },
      callToAction: { type: 'string', description: 'Paragraph 3: Clean closing stating that resume and cover letter are attached for review, and requesting a brief conversation.' },
    },
    required: ['subject', 'opening', 'valueProposition', 'callToAction'],
  };

  const raw = await generateStructuredJson<{
    subject: string;
    opening: string;
    valueProposition: string;
    callToAction: string;
  }>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.2,
  });

  const subject = sanitizeEmDashes(raw.subject || `${jobTitle} Application - ${candidateName}`);
  const opening = sanitizeEmDashes(raw.opening);
  const valueProposition = sanitizeEmDashes(raw.valueProposition);
  const callToAction = sanitizeEmDashes(raw.callToAction);

  const fullBodyText = `${salutation}\n\n${opening}\n\n${valueProposition}\n\n${callToAction}\n\nBest regards,\n${candidateName}\n${profile.phone} | ${profile.linkedinUrl}`;

  const words = `${opening} ${valueProposition} ${callToAction}`.trim().split(/\s+/).length;

  return {
    subject,
    salutation,
    opening,
    valueProposition,
    callToAction,
    fullBodyText,
    wordCount: words,
  };
}

export interface LinkedInPitchResult {
  subject: string;
  messageText: string;
}

export interface GenerateLinkedInPitchOptions {
  jobTitle: string;
  companyName: string;
  recruiterName?: string;
  contactType?: string;
  matchedSkills?: string[];
  jobDescription?: string;
  outreachStrategy?: string;
}

/**
 * Generates a tailored, ready-to-copy LinkedIn Recruiter Direct Message (DM) and InMail Subject.
 */
export async function generateLinkedInRecruiterPitch(
  options: GenerateLinkedInPitchOptions
): Promise<LinkedInPitchResult> {
  const profile = await getProfile();
  const candidateName = profile.name;
  const { jobTitle, companyName, recruiterName, contactType, matchedSkills = [], outreachStrategy = '' } = options;

  const salutation = sanitizeSalutation(recruiterName, companyName, contactType);
  const subject = removeEmDashes(`Application: ${jobTitle} - ${candidateName}`);

  const skillsSnippet = matchedSkills.length > 0
    ? matchedSkills.slice(0, 4).join(', ')
    : 'modern web frameworks, responsive UI architectures, and full-stack development';

  const systemInstruction = `You are a world-class executive career coach creating a high-converting, professional LinkedIn direct message for ${candidateName} to a recruiter.
Rules:
1. STRICT ZERO EM-DASH POLICY: Never use em-dashes (—, –, --). Use commas, periods, or semicolons instead.
2. Tone: Direct, warm, professional, authentic, and concise (<80 words).
3. Candidate is based in the UAE with an active UAE Residence Visa and immediate availability.
4. Candidate has submitted an application on the company's careers portal and attached their tailored CV.
5. All technical claims must be strictly derived from: ${skillsSnippet} and verified candidate profile.`;

  const prompt = `Write a tailored LinkedIn InMail / Direct Message for:
Candidate: ${candidateName}
Target Role: ${jobTitle}
Target Company: ${companyName}
Recruiter / Contact: ${recruiterName || 'Hiring Team'}
Technical Highlights: ${skillsSnippet}
${outreachStrategy ? `Outreach Strategy Directive: ${outreachStrategy}` : ''}

Output JSON format:
{
  "hook": "1 sentence: I noticed the ${jobTitle} opening at ${companyName} and wanted to reach out.",
  "valuePitch": "1 concise sentence: With hands-on experience in ${skillsSnippet}, I specialize in building high-performance, production-ready solutions matching your technical needs.",
  "closing": "1 concise sentence: I have submitted my application on your portal and attached my CV. I am based in the UAE with an active Residence Visa and available immediately. Would you be open to a brief conversation?"
}`;

  try {
    const raw = await generateStructuredJson<{
      hook: string;
      valuePitch: string;
      closing: string;
    }>({
      systemInstruction,
      prompt,
      schema: {
        type: 'object',
        properties: {
          hook: { type: 'string' },
          valuePitch: { type: 'string' },
          closing: { type: 'string' },
        },
        required: ['hook', 'valuePitch', 'closing'],
      },
      temperature: 0.2,
    });

    const hook = removeEmDashes(raw.hook || `I noticed the ${jobTitle} opening at ${companyName} and wanted to reach out.`);
    const valuePitch = removeEmDashes(raw.valuePitch || `With strong hands-on experience in ${skillsSnippet}, I build high-performance, scalable solutions tailored to modern production requirements.`);
    const closing = removeEmDashes(raw.closing || `I have submitted my application on your careers portal and attached my tailored CV. I am based in the UAE with a valid Residence Visa and available immediately. Would you be open to a brief chat?`);

    const messageText = `${salutation}\n\n${hook} ${valuePitch}\n\n${closing}\n\nBest regards,\n${candidateName}`;

    return {
      subject,
      messageText: removeEmDashes(messageText),
    };
  } catch {
    // Deterministic fallback
    const hook = `I noticed the ${jobTitle} opening at ${companyName} and wanted to reach out.`;
    const valuePitch = `With hands-on experience in ${skillsSnippet}, I specialize in developing responsive, scalable web solutions that meet strict production standards.`;
    const closing = `I have submitted my application on your careers portal and attached my tailored CV for review. I am based in the UAE with a valid Residence Visa and available immediately. Would you be open to a brief conversation?`;
    const messageText = `${salutation}\n\n${hook} ${valuePitch}\n\n${closing}\n\nBest regards,\n${candidateName}`;

    return {
      subject,
      messageText: removeEmDashes(messageText),
    };
  }
}
