/**
 * Pulsereach — Dynamic Job-Specific Document Naming Utility
 * Formats clean, descriptive, and mobile-safe filenames for CV and Cover Letter PDFs.
 * Enforces a strict total length cap (≤ 65 characters) to guarantee clean display
 * in Telegram mobile chat bubbles without truncation or folding.
 */

import { getCachedProfile } from '../profile/profile-loader.js';

export interface DocumentNamingOptions {
  docType: 'CV' | 'CoverLetter';
  companyName?: string;
  jobTitle?: string;
  candidateName?: string;
}

/**
 * Sanitizes a string into clean PascalCase tokens suitable for filesystem and messaging filenames.
 */
export function sanitizeToPascalCase(input?: string, maxChars: number = 25): string {
  if (!input || typeof input !== 'string') return '';

  const clean = input
    // Remove all HTML tags and symbols
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim();

  if (!clean) return '';

  const pascal = clean
    .split(/[\s_-]+/)
    .filter((word) => word.length > 0)
    .map((word) => {
      if (word.length <= 3 && word.toUpperCase() === word) {
        return word; // preserve short acronyms like AI, LLC, UAE
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');

  return pascal.slice(0, maxChars);
}

/**
 * Generates a standard, job-specific PDF filename for CVs and Cover Letters.
 * 
 * Rules:
 * - Format: ${Candidate_Name}_CV_${Company}_${JobTitle}.pdf
 * - Format: ${Candidate_Name}_CoverLetter_${Company}_${JobTitle}.pdf
 * - Max Total Length: ≤ 65 characters (Telegram mobile & Gmail safe)
 */
export function generateDocumentFileName(
  docType: 'CV' | 'CoverLetter',
  companyName?: string,
  jobTitle?: string,
  candidateName?: string
): string {
  const isCv = docType === 'CV';
  let cName = candidateName;
  if (!cName) {
    try {
      cName = getCachedProfile().name;
    } catch {
      cName = 'Candidate';
    }
  }

  const cleanCandidate = sanitizeToPascalCase(cName, 18) || 'Candidate';
  const prefix = isCv ? `${cleanCandidate}_CV` : `${cleanCandidate}_CoverLetter`;

  // Company: max 20 chars
  const cleanCompany = sanitizeToPascalCase(companyName, 20) || 'Company';

  // Job Title: max 25 chars (CV) or 20 chars (CoverLetter due to longer prefix)
  const maxTitleChars = isCv ? 25 : 20;
  const cleanTitle = sanitizeToPascalCase(jobTitle, maxTitleChars) || 'SoftwareEngineer';

  let base = `${prefix}_${cleanCompany}_${cleanTitle}`;

  // Strict 65-character total limit (61 base + 4 for ".pdf")
  if (base.length > 61) {
    base = base.slice(0, 61).replace(/_+$/, '');
  }

  return `${base}.pdf`;
}

/**
 * Extracts company name and job title from a formatted Telegram review card HTML text.
 */
export function extractJobMetadataFromCardText(text?: string): { companyName?: string; jobTitle?: string } {
  if (!text || typeof text !== 'string') return {};

  // Pattern 1: 🚀 <b>{Job Title}</b> @ <b>{Company}</b>
  const boldMatch = text.match(/🚀\s*<b>(.*?)<\/b>\s*@\s*<b>(.*?)<\/b>/i);
  if (boldMatch) {
    return {
      jobTitle: boldMatch[1].replace(/<[^>]+>/g, '').trim(),
      companyName: boldMatch[2].replace(/<[^>]+>/g, '').trim(),
    };
  }

  // Pattern 2: 🚀 {Job Title} @ {Company}
  const plainMatch = text.match(/🚀\s*(.*?)\s*@\s*(.*?)(?:\n|📍|$)/i);
  if (plainMatch) {
    return {
      jobTitle: plainMatch[1].replace(/<[^>]+>/g, '').trim(),
      companyName: plainMatch[2].replace(/<[^>]+>/g, '').trim(),
    };
  }

  return {};
}
