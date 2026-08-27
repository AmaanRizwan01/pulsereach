/**
 * Pulsereach — Centralized Typed AI Prompt Catalog
 * Clean, structured prompts for matching, tailoring, cold outreach, follow-ups, and recruiter response handling.
 */

export interface JobMatchPromptData {
  candidateName: string;
  candidateHeadline: string;
  candidateSkills: string[];
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
}

export function buildJobMatchPrompt(data: JobMatchPromptData): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are an expert technical recruiting AI. Evaluate the match between a verified candidate profile and a target UAE tech opening.
CRITICAL HARD RULES:
1. Honest, evidence-backed evaluation with zero hallucinations.
2. Return a structured JSON response with fit_score (0-100), key_strengths, missing_requirements, and should_apply boolean.
3. NEVER use em-dashes (— or --).`;

  const prompt = `CANDIDATE:
Name: ${data.candidateName}
Headline: ${data.candidateHeadline}
Skills: ${data.candidateSkills.join(', ')}

TARGET OPENING:
Title: ${data.jobTitle}
Company: ${data.jobCompany}
Description:
${data.jobDescription.slice(0, 6000)}`;

  return { systemInstruction, prompt };
}

export interface OutreachEmailPromptData {
  candidateName: string;
  candidateLocation: string;
  candidateSkills: string[];
  candidateVerifiedProjects?: string[];
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  contactName?: string;
  contactType?: string;
  outreachStrategy?: string;
}

export function buildOutreachEmailPrompt(data: OutreachEmailPromptData): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are an elite, high-converting technical outreach specialist writing a personalized cold application email to a hiring team in the UAE.

CRITICAL HARD RULES:
1. WORD LIMIT: Strictly under 120 words total across 3 short, punchy paragraphs.
2. ZERO EM-DASHES: Absolutely no em-dashes (— or --). Use standard commas, periods, or parentheses instead.
3. AUTHENTIC & NATURAL TONE: Write like an exceptional, proactive human software engineer reaching out directly. Do NOT sound like an AI or use robotic template cliches.
4. ATTACHMENT PHRASING: In Paragraph 3, ALWAYS say "I have attached my resume and cover letter for your review." (or "My resume and cover letter are attached for your reference."). NEVER use the words "tailored", "customized", "generated", or "PDFs".
5. HYPER-PERSONALIZATION & RELEVANCE:
   - Paragraph 1: Direct, enthusiastic hook stating interest in the ${data.jobTitle} position at ${data.companyName}, highlighting UAE Residence Visa holder status and immediate availability (0-day notice).
   - Paragraph 2: High-signal technical value proposition. Directly bridge the candidate's verified hands-on engineering background (modern TypeScript/Next.js platforms, scalable backends, database architecture, or Linux/cloud infrastructure) to the core requirements in the job description. Show specifically how the candidate can deliver value to ${data.companyName}.
   - Paragraph 3: Professional, frictionless call-to-action inviting a brief conversation, noting that resume and cover letter are attached.
6. ZERO HALLUCINATION: Anchor exclusively in verified candidate background.`;

  const prompt = `CANDIDATE GROUND TRUTH:
Name: ${data.candidateName}
Location & Visa: ${data.candidateLocation}
Key Technical Skills: ${data.candidateSkills.join(', ')}
${data.candidateVerifiedProjects && data.candidateVerifiedProjects.length > 0 ? `Verified Projects & Production Work:\n${data.candidateVerifiedProjects.join('\n')}` : ''}

TARGET COMPANY & POSITION:
Company Name: ${data.companyName}
Target Role: ${data.jobTitle}
${data.contactName ? `Recipient Contact: ${data.contactName} (${data.contactType || 'Hiring Team'})` : ''}
${data.outreachStrategy ? `Strategic Angle: ${data.outreachStrategy}` : ''}

JOB DESCRIPTION & REQUIREMENTS:
${data.jobDescription.slice(0, 6000)}

TASK:
Write a hyper-relevant, high-signal 3-paragraph outreach email that convinces the recruiter at ${data.companyName} that ${data.candidateName} is the ideal candidate for the ${data.jobTitle} role.`;

  return { systemInstruction, prompt };
}

export interface FollowUpPromptData {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  sequenceType: 'day_4' | 'day_9';
  originalSubject: string;
}

export function buildFollowUpPrompt(data: FollowUpPromptData): { systemInstruction: string; prompt: string } {
  const isDay4 = data.sequenceType === 'day_4';

  const systemInstruction = `You are an elite technical outreach specialist writing a follow-up email.
CRITICAL HARD RULES:
1. ${isDay4 ? 'Day 4 Value-Add Follow-Up: Under 80 words.' : 'Day 9 Clean Break / Final Check-In: Under 50 words.'}
2. Zero em-dashes (— or --).
3. Professional, concise, respectful of their time.
4. Keep the subject line identical or as a reply to: "${data.originalSubject}".`;

  const prompt = `Candidate: ${data.candidateName}
Company: ${data.companyName}
Role: ${data.jobTitle}
Sequence: ${data.sequenceType === 'day_4' ? 'Day 4 follow-up' : 'Day 9 final follow-up'}

Generate the follow-up email JSON.`;

  return { systemInstruction, prompt };
}
