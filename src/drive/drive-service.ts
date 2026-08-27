/**
 * Pulsereach — Google Drive Storage Service
 * Archives compiled single-page A4 PDFs into organized subfolders within "Pulsereach Applications"
 * (Resumes/ and Cover Letters/) on Account 1 (rizwan.shan2016@gmail.com / 5TB Storage).
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import { getEnv } from '../config/env.js';
import { throttle } from '../rate-limiter/token-bucket.js';
import { generateDocumentFileName } from '../utils/file-naming.js';

function getStorageDriveClient(): any {
  const env = getEnv();
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET
  );
  auth.setCredentials({
    refresh_token: env.GOOGLE_STORAGE_REFRESH_TOKEN,
  });
  return google.drive({ version: 'v3', auth: auth as any });
}

let cachedRootFolderId: string | null = null;
const cachedSubfolderIds: Record<string, string> = {};

/**
 * Gets or creates a folder under a specified parent in Google Drive.
 */
async function getOrCreateFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const cacheKey = `${parentFolderId || 'root'}:${folderName}`;
  if (cachedSubfolderIds[cacheKey]) return cachedSubfolderIds[cacheKey];

  await throttle('sheets');
  const drive = getStorageDriveClient();

  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const existing = res.data.files?.[0];
  if (existing?.id) {
    cachedSubfolderIds[cacheKey] = existing.id;
    return existing.id;
  }

  const folderMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    folderMetadata.parents = [parentFolderId];
  }

  const createRes = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });

  const newId = createRes.data.id || '';
  cachedSubfolderIds[cacheKey] = newId;
  return newId;
}

/**
 * Gets or creates the main "Pulsereach Applications" root folder.
 */
export async function getOrCreateApplicationsRootFolder(): Promise<string> {
  if (cachedRootFolderId) return cachedRootFolderId;
  cachedRootFolderId = await getOrCreateFolder('Pulsereach Applications');
  return cachedRootFolderId;
}

/**
 * Gets or creates category subfolders: "Resumes" or "Cover Letters".
 */
export async function getOrCreateSubfolder(
  category: 'Resumes' | 'Cover Letters'
): Promise<string> {
  const rootId = await getOrCreateApplicationsRootFolder();
  return getOrCreateFolder(category, rootId);
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

/**
 * Uploads an in-memory PDF Buffer to a specific Google Drive subfolder with public link read permissions.
 */
export async function uploadPdfToDrive(
  fileName: string,
  pdfBuffer: Buffer,
  category: 'Resumes' | 'Cover Letters' = 'Resumes'
): Promise<DriveUploadResult> {
  await throttle('sheets');
  const drive = getStorageDriveClient();

  const targetFolderId = await getOrCreateSubfolder(category);

  // Clean up any existing duplicate file with identical name in this folder
  try {
    const safeName = fileName.replace(/'/g, "\\'");
    const existing = await drive.files.list({
      q: `name = '${safeName}' and '${targetFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });
    if (existing.data.files && existing.data.files.length > 0) {
      for (const oldFile of existing.data.files) {
        if (oldFile.id) {
          await drive.files.delete({ fileId: oldFile.id }).catch(() => {});
        }
      }
    }
  } catch (err: any) {
    // Non-fatal if listing existing files encounters an error
  }

  const fileMetadata: any = {
    name: fileName,
    parents: [targetFolderId],
  };

  const stream = new Readable();
  stream.push(pdfBuffer);
  stream.push(null);

  const media = {
    mimeType: 'application/pdf',
    body: stream,
  };

  const fileRes = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = fileRes.data.id || '';
  const webViewLink = fileRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  // Make the file viewable with link
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (err: any) {
    console.warn(`[DriveService] Non-fatal permission notice: ${err.message}`);
  }

  return {
    fileId,
    webViewLink,
  };
}

/**
 * Deletes an old PDF file from Google Drive (used if regenerating after an ATS iteration).
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  if (!fileId) return true;
  await throttle('sheets');
  const drive = getStorageDriveClient();
  try {
    await drive.files.delete({ fileId });
    return true;
  } catch (err: any) {
    console.warn(`[DriveService] Failed to delete file ${fileId}: ${err.message}`);
    return false;
  }
}

/**
 * Converts any response data (Buffer, ArrayBuffer, Stream, or GaxiosResponse) into a Buffer.
 */
async function toBuffer(data: any): Promise<Buffer | null> {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  // If it's a readable stream
  if (typeof data.on === 'function' || typeof data[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  return null;
}

/**
 * Downloads a PDF file from Google Drive as a binary Buffer.
 * Supports passing either a raw fileId or a full drive.google.com/file/d/{fileId}/view URL.
 * Resiliently handles multi-account authentication (Account 1 storage + Account 2 fallback + Direct export).
 */
export async function downloadDrivePdfBuffer(fileIdOrUrl: string): Promise<Buffer | null> {
  if (!fileIdOrUrl) return null;
  await throttle('sheets');

  let fileId = fileIdOrUrl;
  if (fileIdOrUrl.includes('/d/')) {
    const match = fileIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    }
  } else if (fileIdOrUrl.includes('id=')) {
    const match = fileIdOrUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    }
  }

  // 1. Try downloading with Primary Storage Account (Account 1: rizwan.shan2016)
  try {
    const drive = getStorageDriveClient();
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const buf = await toBuffer(res.data);
    if (buf && buf.length > 100) {
      return buf;
    }
  } catch (err: any) {
    console.warn(`[DriveService] Primary storage download attempt failed for ${fileId}: ${err.message}`);
  }

  // 2. Fallback: Try downloading with Outreach Account (Account 2: amaanrizwan2016)
  try {
    const env = getEnv();
    if (env.GMAIL_REFRESH_TOKEN && env.GMAIL_REFRESH_TOKEN !== env.GOOGLE_STORAGE_REFRESH_TOKEN) {
      const auth = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
      const fallbackDrive: any = google.drive({ version: 'v3', auth: auth as any });
      const res = await fallbackDrive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      const buf = await toBuffer(res.data);
      if (buf && buf.length > 100) {
        return buf;
      }
    }
  } catch (fallbackErr: any) {
    console.warn(`[DriveService] Fallback account download failed for ${fileId}: ${fallbackErr.message}`);
  }

  // 3. Web export fallback for public/shared view links
  try {
    const directUrls = [
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
    ];
    for (const url of directUrls) {
      try {
        const fetchRes = await fetch(url, { redirect: 'follow' });
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          if (arrayBuf.byteLength > 500) {
            const buf = Buffer.from(arrayBuf);
            // Verify it's not an HTML error page (PDF magic bytes: %PDF)
            if (buf.slice(0, 5).toString('ascii').startsWith('%PDF')) {
              return buf;
            }
          }
        }
      } catch {}
    }
  } catch {}

  return null;
}

/**
 * Archives finalized Resume and Cover Letter PDFs into their respective subfolders.
 * Ensures exactly 1 resume and 1 cover letter exist in Drive for the job.
 */
export async function archiveApplicationPdfs(options: {
  companyName: string;
  jobTitle: string;
  resumePdfBuffer: Buffer;
  coverLetterPdfBuffer?: Buffer;
}): Promise<{
  resumeFileId: string;
  resumeDriveUrl: string;
  coverLetterFileId?: string;
  coverLetterDriveUrl?: string;
}> {
  const resumeFileName = generateDocumentFileName('CV', options.companyName, options.jobTitle);
  const resumeUpload = await uploadPdfToDrive(resumeFileName, options.resumePdfBuffer, 'Resumes');

  let coverLetterFileId: string | undefined;
  let coverLetterDriveUrl: string | undefined;

  if (options.coverLetterPdfBuffer) {
    const coverFileName = generateDocumentFileName('CoverLetter', options.companyName, options.jobTitle);
    const coverUpload = await uploadPdfToDrive(coverFileName, options.coverLetterPdfBuffer, 'Cover Letters');
    coverLetterFileId = coverUpload.fileId;
    coverLetterDriveUrl = coverUpload.webViewLink;
  }

  return {
    resumeFileId: resumeUpload.fileId,
    resumeDriveUrl: resumeUpload.webViewLink,
    coverLetterFileId,
    coverLetterDriveUrl,
  };
}
