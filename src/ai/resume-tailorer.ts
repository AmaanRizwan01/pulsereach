/**
 * Pulsereach — AI Resume Tailoring & ATS Optimization Engine
 * Tailors candidate resumes to target job descriptions with dynamic project selection, flexible bullet allocation, and self-correction loops.
 */

import { generateStructuredJson } from './index.js';
import { CandidateMasterProfile, VerifiedProject, VerifiedExperience } from '../profile/types.js';
import { getProfile, getCachedProfile } from '../profile/profile-loader.js';
import { ResumeData } from './resume-compiler.js';
import { evaluateResumeAtsScore, AtsEvaluationResult } from './ats-evaluator.js';

export interface TailorResumeOptions {
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  outreachStrategy?: string;
  atsKeywordsAndPhrasing?: string;
  matchedSkills?: string[];
  candidateProfile?: Partial<CandidateMasterProfile>;
  minAtsScoreThreshold?: number;
}

export interface TailoredResumeOutput {
  resumeData: ResumeData;
  atsResult: AtsEvaluationResult;
  projectCount: number;
}

interface RawTailorResponse {
  tailoredHeadline: string;
  tailoredSummary: string;
  selectedProjectIds: string[];
  tailoredProjects: Array<{
    id: string;
    technologies?: string;
    bullets: string[];
  }>;
  tailoredExperience: Array<{
    company: string;
    role?: string;
    bullets: string[];
  }>;
  reorderedSkills: {
    languages: string[];
    frontend: string[];
    backend: string[];
    cloudDevops: string[];
    databases: string[];
    tools: string[];
  };
}

/**
 * Removes em-dashes from generated text strings to comply with strict zero em-dash invariant.
 */
function sanitizeEmDashes(text: string): string {
  if (!text) return '';
  return text
    .replace(/—/g, ', ')
    .replace(/--/g, ', ')
    .replace(/ – /g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dynamically selects certifications relevant to the target role.
 */
export function selectRelevantCertifications(
  jobTitle: string,
  jobDescription: string,
  maxCerts: number = 2
): Array<{ name: string; issuer: string }> {
  const all = getCachedProfile().certifications || [];
  const combined = `${jobTitle} ${jobDescription}`.toLowerCase();

  const isPython = /python|machine learning|artificial intelligence|\bai\b|data science|django|flask|fastapi|pandas/i.test(combined);
  const isWeb = /javascript|typescript|react|next\.?js|frontend|front-end|html|css|web developer|ui|vue|angular/i.test(combined);
  const isBackend = /backend|back-end|api|node\.?js|server|cloud|database|postgresql|sql|microservice/i.test(combined);

  if (isPython && !isWeb) {
    return all.filter((c) => c.name === 'Python' || c.name === 'Introduction to Programming').slice(0, maxCerts);
  }

  if (isWeb) {
    const webSelected: Array<{ name: string; issuer: string }> = [];
    const js2 = all.find((c) => c.name === 'JavaScript Essentials 2');
    const htmlCss = all.find((c) => c.name === 'HTML/CSS Fundamentals');
    const js1 = all.find((c) => c.name === 'JavaScript Essentials 1');

    if (js2) webSelected.push(js2);
    if (htmlCss && webSelected.length < maxCerts) webSelected.push(htmlCss);
    if (js1 && webSelected.length < maxCerts) webSelected.push(js1);
    return webSelected.slice(0, maxCerts);
  }

  if (isBackend) {
    return all.filter((c) => c.name === 'JavaScript Essentials 2' || c.name === 'Python').slice(0, maxCerts);
  }

  return all.slice(0, maxCerts);
}

/**
 * Tailors a candidate resume against a target job vacancy.
 */
export async function tailorResume(options: TailorResumeOptions): Promise<TailoredResumeOutput> {
  const {
    jobTitle,
    jobDescription,
    companyName,
    outreachStrategy = '',
    atsKeywordsAndPhrasing = '',
    matchedSkills = [],
    minAtsScoreThreshold = 85,
  } = options;

  const activeProfile = await getProfile();
  const catalog: CandidateMasterProfile = options.candidateProfile
    ? { ...activeProfile, ...options.candidateProfile }
    : activeProfile;

  const availableProjectKeys = Object.keys(catalog.projects || {});
  const availableProjectKeysList = availableProjectKeys.map((k) => `'${k}'`).join(', ') || "'project_1'";

  const systemInstruction = `You are an elite technical resume writer and senior executive technical recruiter.
Your task is to tailor ${catalog.name}'s resume for the target opening at ${companyName} (${jobTitle}) to maximize candidate fit, achieve an ATS pass rate >= 92%, and present ${catalog.name} as the ideal hire.

CRITICAL TAILORING & FOCUS RULES:
1. RELEVANCE & ATS KEYWORD MAXIMIZATION:
   - You MUST identify and incorporate core technical keywords, frameworks, databases, and domain terminology explicitly mentioned in the Job Description (JD).
   - Rephrase summary and project bullets to heavily feature technologies from the job description.
2. AGGRESSIVE GOOGLE XYZ METRIC BULLETS:
   - Rephrase bullets to feature the exact keywords and frameworks mentioned in the JD using Google XYZ metric format ("Accomplished [X] as measured by [Y] by doing [Z]").
   - Allocate 3 to 4 high-impact bullets per project and experience (NEVER below 3 bullets per project!).
   - Ensure each bullet is dense with quantifiable metrics (%, ms latency, throughput, users, FPS) and active action verbs.
3. STRICT CANDIDATE TRUTH-ANCHORING:
   - All experiences, degrees, and projects must stem exclusively from ${catalog.name}'s verified catalog. Do NOT invent new companies or degrees.
4. STRICT ZERO EM-DASHES:
   - NEVER use em-dashes (— or --). Use standard commas, colons, or parentheses instead.
5. DYNAMIC PROJECT SELECTION (EXACTLY 3 PROJECTS):
   - Select 3 projects best aligning with the target technical stack and domain requirements.
   - Available projects: ${availableProjectKeysList}.
6. DYNAMIC PROFESSIONAL SUMMARY:
   - Write a sharp, punchy 2-3 sentence summary specifically tailored to ${companyName} and ${jobTitle}, front-loading the exact tech stack and engineering capabilities required by the role.
   - Always conclude with: "${catalog.visaStatus || 'Based in UAE (UAE Residence Visa Holder, available immediately)'}."
7. SKILLS FRONT-LOADING:
   - In each skill category, place technologies matching the job description FIRST in the array.
8. FAANG-GRADE TAILORED HEADLINE:
   - Generate a laser-focused, differentiated technical headline front-loading the exact target role, top 3 matched core technologies from the JD, and domain specialization.
   - Format: "[Target Role / Seniority] | [Top 3 Core Technologies] | [Domain / Architecture Focus]"
   - Example: "Full-Stack Software Engineer | Next.js, TypeScript, PostgreSQL | High-Throughput Web Platforms & SaaS" or "Frontend Engineer | React, Next.js, TypeScript | Responsive UI & Web Performance".
   - NEVER use a vague generic one-liner like "Software Engineer". Make it stand out immediately in a 6-second recruiter screen.`;

  const prompt = `TARGET JOB VACANCY:
Title: ${jobTitle}
Company: ${companyName}
Matched Skills: ${matchedSkills.join(', ')}
${outreachStrategy ? `Outreach Strategy Guidance: ${outreachStrategy}` : ''}
${atsKeywordsAndPhrasing ? `ATS Keywords & Exact Phrasing to emphasize: ${atsKeywordsAndPhrasing}` : ''}

Job Description:
${jobDescription.slice(0, 6000)}

CANDIDATE PROFILE TO TAILOR:
Name: ${catalog.name}
Visa: ${catalog.visaStatus}
Summary Baseline: ${catalog.defaultSummary}

Verified Projects Available:
${Object.entries(catalog.projects || {})
  .map(
    ([id, p]: [string, VerifiedProject]) => `[${id}] ${p.name} | Tech: ${p.technologies} | Tags: ${(p.domainTags || []).join(', ')}\nBaseline Bullets:\n${(p.bullets || []).map((b: string) => `  * ${b}`).join('\n')}`
  )
  .join('\n\n')}

Verified Work Experience:
${(catalog.experience || [])
  .map(
    (e: VerifiedExperience) => `${e.role} at ${e.company} (${e.period})\n${(e.bullets || []).map((b: string) => `  * ${b}`).join('\n')}`
  )
  .join('\n\n')}

Verified Certifications:
${(catalog.certifications || []).map((c) => `* ${c.name} | ${c.issuer}`).join('\n')}

Generate the optimal tailored resume JSON.`;

  const schema = {
    type: 'object',
    properties: {
      tailoredHeadline: { type: 'string' },
      tailoredSummary: { type: 'string' },
      selectedProjectIds: { type: 'array', items: { type: 'string' } },
      tailoredProjects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            technologies: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'bullets'],
        },
      },
      tailoredExperience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            role: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
          },
          required: ['company', 'bullets'],
        },
      },
      reorderedSkills: {
        type: 'object',
        properties: {
          languages: { type: 'array', items: { type: 'string' } },
          frontend: { type: 'array', items: { type: 'string' } },
          backend: { type: 'array', items: { type: 'string' } },
          cloudDevops: { type: 'array', items: { type: 'string' } },
          databases: { type: 'array', items: { type: 'string' } },
          tools: { type: 'array', items: { type: 'string' } },
        },
        required: ['languages', 'frontend', 'backend', 'cloudDevops', 'databases', 'tools'],
      },
    },
    required: [
      'tailoredHeadline',
      'tailoredSummary',
      'selectedProjectIds',
      'tailoredProjects',
      'tailoredExperience',
      'reorderedSkills',
    ],
  };

  const rawTailor = await generateStructuredJson<RawTailorResponse>({
    systemInstruction,
    prompt,
    schema,
    temperature: 0.2,
  });

  const projectList = Object.values(catalog.projects || {}) as VerifiedProject[];
  const defaultProject: VerifiedProject = projectList[0] || {
    id: 'project_1',
    name: 'Featured Engineering Project',
    domainTags: ['fullstack'],
    technologies: 'TypeScript, Modern Frameworks, REST APIs',
    period: '2025 - Present',
    bullets: ['Designed and delivered production-grade software solutions.'],
    metrics: ['High reliability'],
  };

  // Map into strongly typed ResumeData model with em-dash sanitization
  const compiledProjects = (rawTailor.tailoredProjects || []).map((tp) => {
    const orig = catalog.projects[tp.id] || defaultProject;
    return {
      name: sanitizeEmDashes(orig.name),
      technologies: sanitizeEmDashes(tp.technologies || orig.technologies),
      period: sanitizeEmDashes(orig.period || ''),
      bullets:
        tp.bullets && tp.bullets.length > 0
          ? tp.bullets.map(sanitizeEmDashes)
          : orig.bullets.map(sanitizeEmDashes),
    };
  });

  const compiledExperience = (rawTailor.tailoredExperience || []).map((te, idx) => {
    const orig = catalog.experience[idx] || catalog.experience[0] || {
      company: 'Software Engineering',
      role: 'Software Engineer',
      period: '2025 - Present',
      bullets: ['Engineered scalable web applications and cloud infrastructure.'],
      domainTags: ['engineering'],
    };
    return {
      company: sanitizeEmDashes(orig.company),
      role: sanitizeEmDashes(orig.role),
      period: sanitizeEmDashes(orig.period),
      bullets:
        te.bullets && te.bullets.length > 0
          ? te.bullets.map(sanitizeEmDashes)
          : orig.bullets.map(sanitizeEmDashes),
    };
  });

  const resumeData: ResumeData = {
    name: catalog.name,
    visaStatus: sanitizeEmDashes(catalog.visaStatus),
    phone: catalog.phone,
    email: catalog.email,
    linkedinUrl: catalog.linkedinUrl,
    githubUrl: catalog.githubUrl,
    portfolioUrl: catalog.portfolioUrl,
    headline: sanitizeEmDashes(rawTailor.tailoredHeadline || catalog.defaultHeadline),
    summary: sanitizeEmDashes(rawTailor.tailoredSummary || catalog.defaultSummary),
    skills: {
      languages: (rawTailor.reorderedSkills?.languages || catalog.skills.languages || []).map(sanitizeEmDashes),
      frontend: (rawTailor.reorderedSkills?.frontend || catalog.skills.frontend || []).map(sanitizeEmDashes),
      backend: (rawTailor.reorderedSkills?.backend || catalog.skills.backend || []).map(sanitizeEmDashes),
      cloudDevops: (rawTailor.reorderedSkills?.cloudDevops || catalog.skills.cloudDevops || []).map(sanitizeEmDashes),
      databases: (rawTailor.reorderedSkills?.databases || catalog.skills.databases || []).map(sanitizeEmDashes),
      tools: (rawTailor.reorderedSkills?.tools || catalog.skills.tools || []).map(sanitizeEmDashes),
    },
    experience: compiledExperience.length > 0 ? compiledExperience : catalog.experience,
    projects:
      compiledProjects.length > 0
        ? compiledProjects
        : projectList.slice(0, 3).map((p: VerifiedProject) => ({
            name: sanitizeEmDashes(p.name),
            technologies: sanitizeEmDashes(p.technologies),
            period: sanitizeEmDashes(p.period || ''),
            bullets: p.bullets.map(sanitizeEmDashes),
          })),
    education: catalog.education,
    certifications: selectRelevantCertifications(jobTitle, jobDescription),
  };

  // Perform ATS evaluation pass
  let atsResult = await evaluateResumeAtsScore({
    resumeData,
    jobTitle,
    jobDescription,
  });

  // ATS Self-Correction Loop (if score < threshold, refine with recommendations)
  if (atsResult.overallAtsScore < minAtsScoreThreshold && atsResult.recommendations.length > 0) {
    console.log(
      `⚠️ ATS score ${atsResult.overallAtsScore} < ${minAtsScoreThreshold}. Triggering ATS self-correction pass...`
    );

    const refinementPrompt = `The previous resume scored ${atsResult.overallAtsScore}/100 on ATS audit.
ATS Recommendations to fix:
${atsResult.recommendations.map((r) => `* ${r}`).join('\n')}

Refine the summary and project bullets to directly address missing keywords and elevate the score >= ${minAtsScoreThreshold}.`;

    try {
      const refined = await generateStructuredJson<RawTailorResponse>({
        systemInstruction,
        prompt: `${prompt}\n\n${refinementPrompt}`,
        schema,
        temperature: 0.2,
      });

      if (refined.tailoredSummary) {
        resumeData.summary = sanitizeEmDashes(refined.tailoredSummary);
      }
      if (refined.tailoredProjects && refined.tailoredProjects.length > 0) {
        resumeData.projects = refined.tailoredProjects.map((tp) => {
          const orig = catalog.projects[tp.id] || defaultProject;
          return {
            name: sanitizeEmDashes(orig.name),
            technologies: sanitizeEmDashes(tp.technologies || orig.technologies),
            period: sanitizeEmDashes(orig.period || ''),
            bullets:
              tp.bullets && tp.bullets.length > 0
                ? tp.bullets.map(sanitizeEmDashes)
                : orig.bullets.map(sanitizeEmDashes),
          };
        });
      }

      atsResult = await evaluateResumeAtsScore({
        resumeData,
        jobTitle,
        jobDescription,
      });
    } catch {
      // Keep initial evaluation
    }
  }

  return {
    resumeData,
    atsResult,
    projectCount: resumeData.projects.length,
  };
}

/**
 * Backward compatibility alias.
 */
export const generateTailoredResumeData = tailorResume;
