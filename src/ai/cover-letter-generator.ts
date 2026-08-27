/**
 * Pulsereach — 4-Paragraph AI Cover Letter Generation Engine
 * Generates role-tailored, truth-anchored cover letters with A4 HTML rendering and zero em-dashes.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';
import { getCachedProfile } from '../profile/profile-loader.js';
import { VerifiedProject, VerifiedEducation } from '../profile/types.js';

export interface GenerateCoverLetterOptions {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  matchedSkills?: string[];
  outreachStrategy?: string;
  atsKeywordsAndPhrasing?: string;
  candidateName?: string;
  candidateLocation?: string;
  candidateEmail?: string;
  candidatePhone?: string;
}

export interface CoverLetterResult {
  recipientTitle: string;
  openingParagraph: string;
  bodyParagraphs: string[];
  closingParagraph: string;
  fullMarkdown: string;
  fullHtml: string;
  wordCount: number;
}

/**
 * Generates a clean, single-page A4 HTML document for a cover letter.
 */
export function generateCoverLetterHtml(data: {
  candidateName: string;
  candidateLocation: string;
  candidatePhone: string;
  candidateEmail: string;
  companyName: string;
  recipientTitle: string;
  openingParagraph: string;
  bodyParagraphs: string[];
  closingParagraph: string;
  formattedDate?: string;
}): string {
  const dateStr =
    data.formattedDate ||
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${data.candidateName} - Cover Letter for ${data.companyName}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 20mm 18mm 20mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    background: #ffffff;
    line-height: 1.5;
    font-size: 10pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    border-bottom: 1.5px solid #111827;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .header h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #111827;
    margin-bottom: 2px;
    text-transform: uppercase;
  }
  .header-meta {
    font-size: 9pt;
    color: #4b5563;
  }
  .date {
    margin-bottom: 14px;
    font-size: 9.5pt;
    color: #374151;
  }
  .salutation {
    font-weight: 600;
    margin-bottom: 12px;
    color: #111827;
  }
  p {
    margin-bottom: 12px;
    text-align: justify;
    color: #1f2937;
  }
  .sign-off {
    margin-top: 20px;
  }
  .sign-off-name {
    font-weight: 700;
    margin-top: 4px;
    color: #111827;
  }
</style>
</head>
<body>

<div class="header">
  <h1>${data.candidateName}</h1>
  <div class="header-meta">${data.candidateLocation} | ${data.candidatePhone} | ${data.candidateEmail}</div>
</div>

<div class="date">${dateStr}</div>

<div class="salutation">Dear ${data.recipientTitle} at ${data.companyName},</div>

<p>${data.openingParagraph}</p>

${data.bodyParagraphs.map((p) => `<p>${p}</p>`).join('\n')}

<p>${data.closingParagraph}</p>

<div class="sign-off">
  <div>Sincerely,</div>
  <div class="sign-off-name">${data.candidateName}</div>
</div>

</body>
</html>`;
}

/**
 * Generates a tailored 4-paragraph cover letter for a target opening.
 */
export async function generateCoverLetter(
  options: GenerateCoverLetterOptions
): Promise<CoverLetterResult> {
  const profile = getCachedProfile();
  const candidateName = options.candidateName || profile.name;
  const candidateLocation = options.candidateLocation || profile.visaStatus;
  const candidateEmail = options.candidateEmail || profile.email;
  const candidatePhone = options.candidatePhone || profile.phone;

  const {
    jobTitle,
    companyName,
    jobDescription,
    matchedSkills = [],
    outreachStrategy = '',
    atsKeywordsAndPhrasing = '',
  } = options;

  const projectSummaries = (Object.values(profile.projects || {}) as VerifiedProject[])
    .map((p: VerifiedProject) => `        - ${p.name} (${p.technologies}). Key metrics: ${(p.metrics || []).join(', ')}`)
    .join('\n');

  const educationSummaries = (profile.education || [])
    .map((e: VerifiedEducation) => `      * Education: ${e.degree} from ${e.institution}${e.grade ? ` (${e.grade} GPA)` : ''}.`)
    .join('\n');

  const systemInstruction = `You are an elite technical career coach and hiring consultant.
Your task is to generate a concise, compelling 4-paragraph cover letter for a software engineer applying to ${companyName} for the ${jobTitle} role.

CRITICAL HARD RULES:
1. STRICT ZERO EM-DASH POLICY:
   - NEVER use em-dashes (— or --) anywhere in the cover letter.
   - Use standard commas, colons, parentheses, or periods instead.
2. STRICT TRUTH-ANCHORING:
   - ONLY reference verified candidate experience for ${candidateName}:
${educationSummaries || '      * Verified Software Engineering degree and diplomas.'}
      * Status: ${candidateLocation || 'Available immediately'}.
      * Real Projects:
${projectSummaries || '        - Production web applications and cloud infrastructure projects.'}
   - NEVER invent unverified employers, projects, or metrics.
3. 4-PARAGRAPH ARCHITECTURE:
   - Paragraph 1 (Direct Hook & Availability): Express strong enthusiasm for ${companyName}'s ${jobTitle} opening, stating work authorization/visa status and immediate availability.
   - Paragraph 2 (Technical Alignment): Highlight direct technical alignment between the candidate's core stack and the job description requirements.
   - Paragraph 3 (Production Impact Deep-Dive): Walk through 1 or 2 matching verified projects with concrete metrics and architectural decisions.
   - Paragraph 4 (Frictionless CTA): Professional sign-off indicating readiness for a technical interview or discussion.
4. LENGTH & TONE:
   - Word count must be strictly between 250 and 350 words (maximum 400 words).
   - Confident, technical, and articulate.`;

  const prompt = `TARGET OPENING:
Title: ${jobTitle}
Company: ${companyName}
Matched Skills: ${matchedSkills.join(', ')}
${outreachStrategy ? `Outreach Strategy Guidance: ${outreachStrategy}` : ''}
${atsKeywordsAndPhrasing ? `ATS Keywords: ${atsKeywordsAndPhrasing}` : ''}

Job Description:
${jobDescription.slice(0, 6000)}

CANDIDATE PROFILE:
Name: ${candidateName}
Location/Status: ${candidateLocation}
Phone: ${candidatePhone} | Email: ${candidateEmail}

Generate the structured 4-paragraph cover letter JSON.`;

  const schema = {
    type: 'object',
    properties: {
      recipientTitle: {
        type: 'string',
        description: 'Recipient salutation title (e.g. "Hiring Manager" or "Engineering Team")',
      },
      openingParagraph: {
        type: 'string',
        description: 'Paragraph 1: Direct hook, target role, company, and UAE immediate availability.',
      },
      bodyParagraphs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exactly 2 paragraphs: Paragraph 2 (Technical Alignment) and Paragraph 3 (Production Impact Deep-Dive).',
      },
      closingParagraph: {
        type: 'string',
        description: 'Paragraph 4: Frictionless call to action for interview.',
      },
    },
    required: ['recipientTitle', 'openingParagraph', 'bodyParagraphs', 'closingParagraph'],
  };

  const raw = await generateStructuredJson<{
    recipientTitle: string;
    openingParagraph: string;
    bodyParagraphs: string[];
    closingParagraph: string;
  }>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.2,
  });

  const recipientTitle = sanitizeEmDashes(raw.recipientTitle || 'Hiring Manager');
  const openingParagraph = sanitizeEmDashes(raw.openingParagraph);
  const bodyParagraphs = (raw.bodyParagraphs || []).map((p) => sanitizeEmDashes(p));
  const closingParagraph = sanitizeEmDashes(raw.closingParagraph);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const fullMarkdown = `**${candidateName}**
${candidateLocation} | ${candidatePhone} | ${candidateEmail}

${formattedDate}

Dear ${recipientTitle} at ${companyName},

${openingParagraph}

${bodyParagraphs.join('\n\n')}

${closingParagraph}

Sincerely,
${candidateName}`;

  const fullHtml = generateCoverLetterHtml({
    candidateName,
    candidateLocation,
    candidatePhone,
    candidateEmail,
    companyName,
    recipientTitle,
    openingParagraph,
    bodyParagraphs,
    closingParagraph,
    formattedDate,
  });

  const allWords = `${openingParagraph} ${bodyParagraphs.join(' ')} ${closingParagraph}`
    .trim()
    .split(/\s+/).length;

  return {
    recipientTitle,
    openingParagraph,
    bodyParagraphs,
    closingParagraph,
    fullMarkdown,
    fullHtml,
    wordCount: allWords,
  };
}

/**
 * Backward compatibility alias.
 */
export const generateTailoredCoverLetter = generateCoverLetter;
