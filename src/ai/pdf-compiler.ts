/**
 * Pulsereach — Playwright Single-Page A4 PDF Compiler
 * Compiles HTML strings for Resumes and Cover Letters into pixel-perfect PDF buffers.
 */

import { ResumeData, generateResumeHtml } from './resume-compiler.js';
import { CoverLetterResult } from './cover-letter-generator.js';

export interface PdfCompileOptions {
  /** Page size format (default 'A4') */
  format?: 'A4' | 'Letter';
  /** Wait until lifecycle event (default 'domcontentloaded') */
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  /** Maximum rendering timeout in ms (default 15000) */
  timeoutMs?: number;
}

const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--single-process',
  '--disable-gpu',
];

/**
 * Compiles any valid HTML string into an A4 PDF Buffer using headless Chromium.
 * Guarantees browser closure in a finally block to avoid dangling processes.
 *
 * @param html - Complete HTML document string
 * @param options - Compilation configuration options
 * @returns In-memory PDF Buffer
 */
export async function compileHtmlToPdfBuffer(
  html: string,
  options: PdfCompileOptions = {}
): Promise<Buffer> {
  const {
    format = 'A4',
    waitUntil = 'domcontentloaded',
    timeoutMs = 15000,
  } = options;

  let browser: any;
  try {
    const pw: any = await import('playwright');
    const chromium = pw.chromium || pw.default?.chromium;
    if (!chromium) {
      throw new Error('Chromium launcher not found in Playwright package');
    }
    browser = await chromium.launch({
      headless: true,
      args: CHROMIUM_LAUNCH_ARGS,
    });
  } catch (launchErr: any) {
    if (
      launchErr.message?.includes("Executable doesn't exist") ||
      launchErr.message?.includes('Cannot find module')
    ) {
      throw new Error(
        `Playwright Chromium binary is not installed in this environment (${process.env.VERCEL ? 'Vercel Serverless Function' : process.platform}). PDF compilation runs in GitHub Actions where Chromium is installed. (Details: ${launchErr.message})`
      );
    }
    throw launchErr;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil,
      timeout: timeoutMs,
    });

    const pdfUint8 = await page.pdf({
      format,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0px',
        bottom: '0px',
        left: '0px',
        right: '0px',
      },
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Compiles a structured ResumeData object directly into an A4 PDF Buffer.
 */
export async function compileResumePdf(
  resumeData: ResumeData,
  options?: PdfCompileOptions
): Promise<Buffer> {
  const html = generateResumeHtml(resumeData);
  return compileHtmlToPdfBuffer(html, options);
}

/**
 * Compiles tailored cover letter data directly into an A4 PDF Buffer.
 */
export async function compileCoverLetterPdf(
  coverLetter: CoverLetterResult | { fullHtml: string },
  options?: PdfCompileOptions
): Promise<Buffer> {
  const html = 'fullHtml' in coverLetter ? coverLetter.fullHtml : (coverLetter as any).html;
  return compileHtmlToPdfBuffer(html, options);
}
