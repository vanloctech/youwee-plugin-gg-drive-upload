import type { DriveUploadConfig } from "./config.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,mimeType,size,parents";

export interface UploadedDriveFile {
  id: string;
  name?: string;
  webViewLink?: string;
  webContentLink?: string;
  mimeType?: string;
  size?: string;
}

interface GoogleErrorPayload {
  error?: string | { message?: string };
  raw?: string;
}

interface GoogleTokenPayload extends GoogleErrorPayload {
  access_token?: string;
}

export async function exchangeRefreshToken(config: DriveUploadConfig): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await parseJsonResponse<GoogleTokenPayload>(response);

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Failed to exchange refresh token: ${extractGoogleErrorDetails(payload, response.statusText)}`,
    );
  }

  return payload.access_token;
}

export async function uploadFileToGoogleDrive(input: {
  accessToken: string;
  fileBytes: Uint8Array;
  folderId: string;
  filename: string;
  mimeType: string;
}): Promise<UploadedDriveFile> {
  const boundary = `youwee-google-drive-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: input.filename,
    parents: [input.folderId],
  });
  const body = createMultipartRelatedBody({
    boundary,
    metadata,
    fileBytes: input.fileBytes,
    mimeType: input.mimeType,
  });

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: body as unknown as BodyInit,
  });

  const payload = await parseJsonResponse<UploadedDriveFile & GoogleErrorPayload>(response);

  if (!response.ok || !payload.id) {
    throw new Error(
      `Google Drive upload failed: ${extractGoogleErrorDetails(payload, response.statusText)}`,
    );
  }

  return payload;
}

function createMultipartRelatedBody(input: {
  boundary: string;
  metadata: string;
  fileBytes: Uint8Array;
  mimeType: string;
}): Uint8Array {
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${input.boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${input.metadata}\r\n` +
      `--${input.boundary}\r\n` +
      `Content-Type: ${input.mimeType}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${input.boundary}--\r\n`);
  const output = new Uint8Array(prefix.length + input.fileBytes.length + suffix.length);

  output.set(prefix, 0);
  output.set(input.fileBytes, prefix.length);
  output.set(suffix, prefix.length + input.fileBytes.length);

  return output;
}

async function parseJsonResponse<TPayload>(response: Response): Promise<TPayload> {
  const text = await response.text();

  if (!text) {
    return {} as TPayload;
  }

  try {
    return JSON.parse(text) as TPayload;
  } catch {
    return { raw: text } as TPayload;
  }
}

function extractGoogleErrorDetails(payload: GoogleErrorPayload, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback || "Unknown error";
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (payload.error?.message) {
    return payload.error.message;
  }

  if (payload.raw) {
    return payload.raw;
  }

  return fallback || "Unknown error";
}
