import type { PluginContext } from "youwee-sdk";

export interface DriveUploadConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
  filenameFormat: string;
}

export function readConfig(ctx: PluginContext): DriveUploadConfig {
  return {
    clientId: requireStringConfig(ctx, "client_id"),
    clientSecret: requireStringConfig(ctx, "client_secret"),
    refreshToken: requireStringConfig(ctx, "refresh_token"),
    folderId: requireStringConfig(ctx, "folder_id"),
    filenameFormat: ctx.config.get<string>("filename_format") || "{filename}",
  };
}

function requireStringConfig(ctx: PluginContext, key: string): string {
  const value = ctx.config.require<string>(key);

  if (!value.trim()) {
    throw new Error(`Missing required plugin config value: ${key}`);
  }

  return value;
}
