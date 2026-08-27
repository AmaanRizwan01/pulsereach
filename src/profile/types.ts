/**
 * Pulsereach — Candidate Profile Data Types
 * Strongly typed schemas for candidate identity, skills, experiences, projects, and education.
 */

export interface VerifiedProject {
  id: string;
  name: string;
  domainTags: string[];
  technologies: string;
  period: string;
  bullets: string[];
  metrics: string[];
}

export interface VerifiedExperience {
  company: string;
  role: string;
  period: string;
  domainTags: string[];
  bullets: string[];
}

export interface VerifiedEducation {
  institution: string;
  location: string;
  degree: string;
  period: string;
  grade?: string;
}

export interface VerifiedCertification {
  name: string;
  issuer: string;
}

export interface CandidateSkillsCatalog {
  languages: string[];
  frontend: string[];
  backend: string[];
  cloudDevops: string[];
  databases: string[];
  tools: string[];
}

export interface CandidateMasterProfile {
  name: string;
  visaStatus: string;
  phone: string;
  email: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  defaultHeadline: string;
  defaultSummary: string;
  skills: CandidateSkillsCatalog;
  experience: VerifiedExperience[];
  projects: Record<string, VerifiedProject>;
  education: VerifiedEducation[];
  certifications: VerifiedCertification[];
}

export const PROFILE_SCHEMA_VERSION = 1;
