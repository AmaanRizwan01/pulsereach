/**
 * Pulsereach — Candidate Data Adapter & Query Helpers
 * Provides simplified accessors and domain querying over the dynamic candidate profile.
 */

import type {
  CandidateMasterProfile,
  VerifiedProject,
  CandidateSkillsCatalog,
  VerifiedCertification,
} from '../profile/types.js';
import { getCachedProfile } from '../profile/profile-loader.js';

export type { CandidateMasterProfile, VerifiedProject, CandidateSkillsCatalog, VerifiedCertification };

/**
 * Returns the current candidate master profile.
 */
export function getCandidateProfile(): CandidateMasterProfile {
  return getCachedProfile();
}

/**
 * Backward compatibility alias for synchronous profile access.
 */
export const CANDIDATE_PROFILE: CandidateMasterProfile = new Proxy({} as CandidateMasterProfile, {
  get(_target, prop) {
    const profile = getCachedProfile();
    return (profile as any)[prop];
  },
});

/**
 * Retrieves a verified candidate project by its unique identifier.
 *
 * @param id - Project ID (e.g. 'intralead', 'proxmox_infra', 'swipetify')
 */
export function getProjectById(id: string): VerifiedProject | undefined {
  const profile = getCachedProfile();
  return profile.projects[id];
}

/**
 * Returns all verified projects as an array.
 */
export function getAllProjects(): VerifiedProject[] {
  const profile = getCachedProfile();
  return Object.values(profile.projects);
}

/**
 * Filters and scores verified projects based on matching domain tags.
 * Projects with more tag matches are returned first.
 *
 * @param tags - Array of target domain tags (e.g. ['saas', 'nextjs', 'fullstack'])
 * @returns Array of projects sorted by relevance score descending
 */
export function getProjectsByDomain(tags: string[]): VerifiedProject[] {
  const projects = getAllProjects();
  if (!tags || tags.length === 0) {
    return projects;
  }

  const normalizedTags = tags.map((t) => t.toLowerCase().trim());

  const scoredProjects = projects.map((project) => {
    let score = 0;
    for (const projectTag of project.domainTags || []) {
      if (normalizedTags.includes(projectTag.toLowerCase())) {
        score += 1;
      }
    }
    return { project, score };
  });

  return scoredProjects
    .sort((a, b) => b.score - a.score)
    .map((item) => item.project);
}

/**
 * Returns the candidate's complete categorized skills catalog.
 */
export function getSkillTaxonomy(): CandidateSkillsCatalog {
  const profile = getCachedProfile();
  return profile.skills;
}

/**
 * Returns all verified candidate certifications.
 */
export function getCertifications(): VerifiedCertification[] {
  const profile = getCachedProfile();
  return profile.certifications;
}

/**
 * Returns a deduplicated flat array of all verified candidate skills across all categories.
 */
export function getAllSkills(): string[] {
  const skills = getCachedProfile().skills;
  if (!skills) return [];

  const all = [
    ...(skills.languages || []),
    ...(skills.frontend || []),
    ...(skills.backend || []),
    ...(skills.cloudDevops || []),
    ...(skills.databases || []),
    ...(skills.tools || []),
  ];

  return Array.from(new Set(all));
}

/**
 * Formats a clean, em-dash-free plain text candidate summary block.
 */
export function formatCandidateHeader(): string {
  const p = getCachedProfile();
  return [
    `${p.name}`,
    `${p.visaStatus}`,
    `Phone: ${p.phone} | Email: ${p.email}`,
    `LinkedIn: ${p.linkedinUrl} | GitHub: ${p.githubUrl} | Portfolio: ${p.portfolioUrl}`,
    `Headline: ${p.defaultHeadline}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join('\n');
}
