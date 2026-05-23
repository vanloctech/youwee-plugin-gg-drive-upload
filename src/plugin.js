const { definePlugin, triggers } = require("youwee-sdk");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,mimeType,size,parents";

module.exports = definePlugin({
  meta: {
    name: "Google Drive Upload",
    version: "0.1.0",
    description: "Upload completed downloads to Google Drive.",
  },

  hooks: {
    [triggers.downloadCompleted]: async (ctx) => {
      const config = readConfig(ctx);
      const sourceFilepath = requireFilepath(ctx);
      const sourceFilename = ctx.file?.name || basenameFromPath(sourceFilepath);

      ctx.log.info(ctx.i18n.t("log.uploadStarted"), {
        filename: sourceFilename,
        filepath: sourceFilepath,
        folderId: config.folderId,
      });

      try {
        const accessToken = await exchangeRefreshToken(ctx, config);
        const fileBytes = await Deno.readFile(sourceFilepath);
        const targetFilename = buildTargetFilename(ctx, config, sourceFilename);
        const mimeType = inferMimeType(sourceFilename);

        const uploadedFile = await uploadFileToGoogleDrive({
          accessToken,
          fileBytes,
          folderId: config.folderId,
          filename: targetFilename,
          mimeType,
        });

        ctx.log.info(ctx.i18n.t("log.uploadSucceeded"), {
          filename: targetFilename,
          driveFileId: uploadedFile.id,
          webViewLink: uploadedFile.webViewLink || null,
        });

        return ctx.ok(
          ctx.i18n.t("result.success", { filename: targetFilename }),
          {
            driveFileId: uploadedFile.id,
            driveFilename: uploadedFile.name,
            driveFolderId: config.folderId,
            driveWebViewLink: uploadedFile.webViewLink || null,
            driveWebContentLink: uploadedFile.webContentLink || null,
            uploadedMimeType: uploadedFile.mimeType || mimeType,
            uploadedSize: uploadedFile.size || String(fileBytes.byteLength),
            sourceFilepath,
            sourceFilename,
          },
        );
      } catch (error) {
        const message = toErrorMessage(error);

        ctx.log.error(ctx.i18n.t("log.uploadFailed"), {
          error: message,
          filename: sourceFilename,
          filepath: sourceFilepath,
        });

        return ctx.fail(ctx.i18n.t("result.failure", { error: message }), {
          error: message,
          sourceFilepath,
          sourceFilename,
          folderId: config.folderId,
        });
      }
    },
  },
});

function readConfig(ctx) {
  return {
    clientId: ctx.config.require("client_id"),
    clientSecret: ctx.config.require("client_secret"),
    refreshToken: ctx.config.require("refresh_token"),
    folderId: ctx.config.require("folder_id"),
    filenameFormat: ctx.config.get("filename_format") || "{filename}",
  };
}

function requireFilepath(ctx) {
  const filepath = ctx.file?.path;

  if (!filepath) {
    throw new Error(ctx.i18n.t("error.missingFilepath"));
  }

  return filepath;
}

async function exchangeRefreshToken(ctx, config) {
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

  const payload = await parseJsonResponse(response);

  if (!response.ok || !payload.access_token) {
    throw new Error(
      ctx.i18n.t("error.tokenExchangeFailed", {
        details: extractGoogleErrorDetails(payload, response.statusText),
      }),
    );
  }

  return payload.access_token;
}

async function uploadFileToGoogleDrive({
  accessToken,
  fileBytes,
  folderId,
  filename,
  mimeType,
}) {
  const boundary = `youwee-google-drive-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
  });
  const body = createMultipartRelatedBody({
    boundary,
    metadata,
    fileBytes,
    mimeType,
  });

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok || !payload.id) {
    throw new Error(
      `Google Drive upload failed: ${extractGoogleErrorDetails(payload, response.statusText)}`,
    );
  }

  return payload;
}

function createMultipartRelatedBody({ boundary, metadata, fileBytes, mimeType }) {
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const output = new Uint8Array(prefix.length + fileBytes.length + suffix.length);

  output.set(prefix, 0);
  output.set(fileBytes, prefix.length);
  output.set(suffix, prefix.length + fileBytes.length);

  return output;
}

function buildTargetFilename(ctx, config, sourceFilename) {
  const original = splitFilename(sourceFilename);
  const title = sanitizeFilenamePart(ctx.media?.title || "");
  const rendered = renderFilenameFormat(config.filenameFormat, {
    filename: sourceFilename,
    basename: original.basename,
    ext: original.ext,
    title,
    source: ctx.download?.source || "",
    quality: ctx.download?.quality || "",
    format: ctx.download?.format || "",
    date: new Date().toISOString().slice(0, 10),
    timestamp: String(Date.now()),
  });
  const trimmed = sanitizeFilename(rendered || sourceFilename);

  if (!trimmed) {
    return sourceFilename;
  }

  if (hasExtension(trimmed) || !original.ext) {
    return trimmed;
  }

  return `${trimmed}.${original.ext}`;
}

function renderFilenameFormat(template, values) {
  return String(template || "{filename}").replace(/\{([a-z_]+)\}/gi, (_, key) => {
    const value = values[key];
    return value == null ? "" : String(value);
  });
}

function splitFilename(filename) {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return { basename: filename, ext: "" };
  }

  return {
    basename: filename.slice(0, lastDotIndex),
    ext: filename.slice(lastDotIndex + 1),
  };
}

function hasExtension(filename) {
  const parts = splitFilename(filename);
  return Boolean(parts.ext);
}

function sanitizeFilename(filename) {
  return String(filename)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
}

function sanitizeFilenamePart(value) {
  return sanitizeFilename(value).replace(/\./g, " ");
}

function basenameFromPath(filepath) {
  return String(filepath).split(/[\\/]/).pop() || filepath;
}

function inferMimeType(filename) {
  const ext = splitFilename(filename).ext.toLowerCase();

  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mkv":
      return "video/x-matroska";
    case "webm":
      return "video/webm";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "srt":
      return "application/x-subrip";
    case "vtt":
      return "text/vtt";
    case "json":
      return "application/json";
    case "zip":
      return "application/zip";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractGoogleErrorDetails(payload, fallback) {
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

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
