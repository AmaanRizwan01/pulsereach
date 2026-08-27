/**
 * Pulsereach — 5-Factor ATS Evaluator & Scoring Model
 * Evaluates tailored resumes against job requirements targeting >= 85% ATS match scores.
 */

import { generateStructuredJson } from './index.js';
import { ResumeData } from './resume-compiler.js';

export interface AtsEvaluationResult {
  overallAtsScore: number;
  ratingGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  passProbability: 'High (90-99%)' | 'Medium (75-89%)' | 'Low (<75%)';
  keywordMatchRate: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryFitAnalysis: string;
  bulletImpactScore: number;
  recommendations: string[];
}

/**
 * Extracts 10 to 25 core technical keywords, frameworks, and tools from a Job Description.
 */
export async function extractKeywordsFromJobDescription(
  jobTitle: string,
  jobDescription: string
): Promise<string[]> {
  const systemInstruction = `You are an enterprise ATS technical parser. Extract 10 to 25 core technical keywords, tools, frameworks, programming languages, databases, and domain terms explicitly required in the target Job Description. Return them as a clean JSON object with a 'keywords' string array.`;

  const schema = {
    type: 'object',
    properties: {
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exact technical skills, tools, frameworks, and qualifications mentioned in the JD',
      },
    },
    required: ['keywords'],
  };

  try {
    const res = await generateStructuredJson<{ keywords: string[] }>({
      systemInstruction,
      prompt: `Role Title: ${jobTitle}\n\nJob Description:\n${jobDescription.slice(0, 6000)}`,
      schema,
      temperature: 0.1,
    });
    if (res.keywords && res.keywords.length > 0) {
      return res.keywords;
    }
  } catch {
    // Fallback extraction below
  }

  const commonTech = [
    'TypeScript',
    'JavaScript',
    'React',
    'Next.js',
    'Node.js',
    'Python',
    'Java',
    'SQL',
    'PostgreSQL',
    'Docker',
    'AWS',
    'REST APIs',
    'Git',
    'Linux',
    'Tailwind CSS',
    'GraphQL',
    'Redis',
    'CI/CD',
    'FastAPI',
    'HTML5',
    'CSS3',
    'Microservices',
  ];
  const matched = commonTech.filter((tech) =>
    new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i').test(jobDescription)
  );
  return matched.length > 0 ? matched : ['TypeScript', 'JavaScript', 'Node.js', 'PostgreSQL', 'REST APIs'];
}

/**
 * Evaluates a tailored resume against a target job description across 5 weighted factors.
 */
export async function evaluateResumeAtsScore(options: {
  resumeData: ResumeData;
  jobTitle: string;
  jobDescription: string;
  extractedKeywords?: string[];
}): Promise<AtsEvaluationResult> {
  const { resumeData, jobTitle, jobDescription } = options;

  const targetKeywords =
    options.extractedKeywords && options.extractedKeywords.length > 0
      ? options.extractedKeywords
      : await extractKeywordsFromJobDescription(jobTitle, jobDescription);

  const systemInstruction = `You are a state-of-the-art enterprise ATS (Applicant Tracking System) simulator and technical recruiting auditor.
Your job is to evaluate how effectively a candidate's resume matches a target job description for a software engineering opening.

EVALUATION METHODOLOGY:
1. HARD SKILL & TECH STACK MATCH (40% Weight):
   - Measure the presence of exact programming languages, frameworks, databases, cloud tools required by the JD.
2. JOB TITLE & HEADLINE ALIGNMENT (20% Weight):
   - Check if candidate summary, experience titles, and framing directly align with the target role.
3. GOOGLE XYZ & QUANTIFIABLE BULLET IMPACT (20% Weight):
   - Evaluate bullet points for active power verbs (Architected, Engineered, Optimized, Implemented) and measurable metrics.
4. CONTEXTUAL KEYWORD DENSITY (15% Weight):
   - Check that key technologies appear naturally within accomplishment bullets in Experience and Projects.
5. FORMATTING & PARSEABILITY (5% Weight):
   - Clean standard section headings, chronological ordering, single-page fit.

SCORING GUIDELINES:
- Score 90-100 (A+, High 90-99% pass probability): High keyword overlap, strong XYZ bullets with numbers, matching summary.
- Score 85-89 (A, High pass probability): Solid keyword overlap, primary stack items present.
- Score 75-84 (B, Medium pass probability): Acceptable overlap, some minor tools missing.
- Score <75 (C/D, Low pass probability): Noticeable mismatch.`;

  const resumeSummaryText = `
NAME: ${resumeData.name}
VISA & LOCATION: ${resumeData.visaStatus}
PROFESSIONAL SUMMARY: ${resumeData.summary}

TECHNICAL SKILLS:
- Languages: ${resumeData.skills.languages.join(', ')}
- Frontend: ${resumeData.skills.frontend.join(', ')}
- Backend: ${resumeData.skills.backend.join(', ')}
- Cloud & DevOps: ${resumeData.skills.cloudDevops.join(', ')}
- Databases: ${resumeData.skills.databases.join(', ')}
- Tools: ${resumeData.skills.tools.join(', ')}

EXPERIENCE:
${resumeData.experience.map((e) => `${e.role} at ${e.company} (${e.period})\n${e.bullets.map((b) => `  * ${b}`).join('\n')}`).join('\n\n')}

PROJECTS:
${resumeData.projects.map((p) => `${p.name} | Tech: ${p.technologies} (${p.period || ''})\n${p.bullets.map((b) => `  * ${b}`).join('\n')}`).join('\n\n')}

EDUCATION:
${resumeData.education.map((ed) => `${ed.degree}, ${ed.institution} (${ed.period})`).join('\n')}

CERTIFICATIONS:
${(resumeData.certifications || []).map((c) => `- ${c.name} | ${c.issuer}`).join('\n')}
`;

  const prompt = `TARGET ROLE: ${jobTitle}
TARGET KEYWORDS EXTRACTED FROM JD:
${targetKeywords.join(', ')}

JOB DESCRIPTION:
${jobDescription.slice(0, 6000)}

CANDIDATE TAILORED RESUME:
${resumeSummaryText}

Perform an exhaustive ATS audit and return the structured evaluation result.`;

  const schema = {
    type: 'object',
    properties: {
      overallAtsScore: { type: 'number', description: 'Integer score from 0 to 100' },
      ratingGrade: { type: 'string', enum: ['A+', 'A', 'B', 'C', 'D'] },
      passProbability: { type: 'string', enum: ['High (90-99%)', 'Medium (75-89%)', 'Low (<75%)'] },
      keywordMatchRate: { type: 'number', description: 'Percentage of target keywords matched (0 to 100)' },
      matchedKeywords: { type: 'array', items: { type: 'string' } },
      missingKeywords: { type: 'array', items: { type: 'string' } },
      summaryFitAnalysis: { type: 'string', description: 'Under 30 words analysis of summary alignment' },
      bulletImpactScore: { type: 'number', description: 'Score 0 to 100 evaluating XYZ metric strength' },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'overallAtsScore',
      'ratingGrade',
      'passProbability',
      'keywordMatchRate',
      'matchedKeywords',
      'missingKeywords',
      'summaryFitAnalysis',
      'bulletImpactScore',
      'recommendations',
    ],
  };

  try {
    return await generateStructuredJson<AtsEvaluationResult>({
      systemInstruction,
      prompt,
      schema,
      temperature: 0.1,
    });
  } catch (err) {
    console.warn('⚠️ ATS evaluation service failed, returning honest fallback score:', err);
    return {
      overallAtsScore: 0,
      ratingGrade: 'D',
      passProbability: 'Low (<75%)',
      keywordMatchRate: 0,
      matchedKeywords: [],
      missingKeywords: targetKeywords.slice(0, 5),
      summaryFitAnalysis: '⚠️ ATS scoring evaluation service temporarily unavailable.',
      bulletImpactScore: 0,
      recommendations: ['ATS scoring service unavailable; please inspect tailored resume manually before dispatching.'],
    };
  }
}
