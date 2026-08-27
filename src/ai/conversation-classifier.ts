/**
 * Pulsereach — 8-Intent Recruiter Conversation Classifier
 * Classifies incoming recruiter and company replies to trigger appropriate Telegram alerts and reply drafts.
 */

import { generateStructuredJson, sanitizeEmDashes } from './index.js';

export type RecruiterIntent =
  | 'INTERVIEW_INVITATION'
  | 'TECHNICAL_ASSESSMENT'
  | 'SALARY_NOTICE_QUERY'
  | 'MORE_INFO_REQUEST'
  | 'REJECTION'
  | 'OUT_OF_OFFICE'
  | 'AUTOMATED_ACK'
  | 'OTHER';

export interface ClassificationResult {
  intent: RecruiterIntent;
  confidence: number;
  summary: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
  extractedDetails?: {
    proposedTimes?: string[];
    assessmentDeadline?: string;
    salaryQuestions?: string[];
  };
}

/**
 * Classifies an incoming recruiter email into one of 8 discrete recruiting intents.
 */
export async function classifyRecruiterResponse(
  emailBody: string,
  emailSubject?: string
): Promise<ClassificationResult> {
  const systemInstruction = `You are an elite AI recruiting intelligence analyst.
Your job is to classify incoming responses from recruiters and companies into exactly one of the 8 categories:
1. INTERVIEW_INVITATION: Recruiter wants to schedule a screening call, technical interview, or video chat.
2. TECHNICAL_ASSESSMENT: Recruiter sent a coding challenge, take-home test, or HackerRank link.
3. SALARY_NOTICE_QUERY: Recruiter asks about current/expected salary, visa status, or notice period.
4. MORE_INFO_REQUEST: Recruiter asks for portfolio links, GitHub repo, updated resume, or references.
5. REJECTION: Standard rejection, position filled, or not moving forward.
6. OUT_OF_OFFICE: Automated out-of-office autoreply.
7. AUTOMATED_ACK: Automated application receipt acknowledgment (e.g. "We have received your application").
8. OTHER: Any general inquiry or uncategorized message.

Output must strictly adhere to the JSON schema.`;

  const prompt = `INCOMING EMAIL:
${emailSubject ? `Subject: ${emailSubject}\n` : ''}
Body:
${emailBody.slice(0, 3000)}

Classify this email and extract relevant intent details.`;

  const schema = {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'INTERVIEW_INVITATION',
          'TECHNICAL_ASSESSMENT',
          'SALARY_NOTICE_QUERY',
          'MORE_INFO_REQUEST',
          'REJECTION',
          'OUT_OF_OFFICE',
          'AUTOMATED_ACK',
          'OTHER',
        ],
      },
      confidence: { type: 'number', description: 'Confidence between 0.0 and 1.0' },
      summary: { type: 'string', description: 'Under 25 words summary of what the recruiter is asking' },
      urgency: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      suggestedAction: { type: 'string', description: 'Recommended next step for candidate' },
      extractedDetails: {
        type: 'object',
        properties: {
          proposedTimes: { type: 'array', items: { type: 'string' } },
          assessmentDeadline: { type: 'string' },
          salaryQuestions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['intent', 'confidence', 'summary', 'urgency', 'suggestedAction'],
  };

  const raw = await generateStructuredJson<ClassificationResult>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.1,
  });

  return sanitizeEmDashes(raw);
}
