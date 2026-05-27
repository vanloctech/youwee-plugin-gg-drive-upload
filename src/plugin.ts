import {
  definePlugin,
  triggers,
  type PluginDefinition,
  type PluginContext,
  type PluginResult,
} from "youwee-sdk";
import { readConfig } from "./config.ts";
import { exchangeRefreshToken, uploadFileToGoogleDrive } from "./drive.ts";
import { toErrorMessage } from "./errors.ts";
import { readPayloadFileBytes } from "./files.ts";
import { basenameFromPath, buildTargetFilename } from "./filename.ts";
import { inferMimeType } from "./mime.ts";

const plugin = definePlugin({
  meta: {
    name: "Google Drive Upload",
    version: "1.0.0",
    description: "Upload completed downloads to Google Drive.",
  },

  hooks: {
    [triggers.downloadCompleted]: handleDownloadCompleted,
  },
} satisfies PluginDefinition);

export default plugin;

async function handleDownloadCompleted(ctx: PluginContext): Promise<PluginResult> {
  let config: ReturnType<typeof readConfig> | null = null;
  const sourceFilepath = ctx.file?.path || "";
  const sourceFilename = ctx.file.name || basenameFromPath(sourceFilepath);

  try {
    config = readConfig(ctx);
    requireFilepath(ctx);

    ctx.log.info(ctx.i18n.t("log.uploadStarted"), {
      filename: sourceFilename,
      filepath: sourceFilepath,
      folderId: config.folderId,
    });

    const accessToken = await exchangeRefreshToken(config);
    const fileBytes = await readPayloadFileBytes(ctx, sourceFilepath);
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

    return ctx.ok(ctx.i18n.t("result.success", { filename: targetFilename }), {
      driveFileId: uploadedFile.id,
      driveFilename: uploadedFile.name,
      driveFolderId: config.folderId,
      driveWebViewLink: uploadedFile.webViewLink || null,
      driveWebContentLink: uploadedFile.webContentLink || null,
      uploadedMimeType: uploadedFile.mimeType || mimeType,
      uploadedSize: uploadedFile.size || String(fileBytes.byteLength),
      sourceFilepath,
      sourceFilename,
    });
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
      folderId: config?.folderId || null,
    });
  }
}

function requireFilepath(ctx: PluginContext): string {
  const filepath = ctx.file?.path;

  if (!filepath) {
    throw new Error(ctx.i18n.t("error.missingFilepath"));
  }

  return filepath;
}
