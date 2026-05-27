import type { PluginContext } from "youwee-sdk";
import type { DriveUploadConfig } from "./config.ts";

export function buildTargetFilename(
  ctx: PluginContext,
  config: DriveUploadConfig,
  sourceFilename: string,
): string {
  const original = splitFilename(sourceFilename);
  const title = sanitizeFilenamePart(ctx.media.title || "");
  const rendered = renderFilenameFormat(config.filenameFormat, {
    filename: sourceFilename,
    basename: original.basename,
    ext: original.ext,
    title,
    source: ctx.download.source || "",
    quality: ctx.file.quality || "",
    format: ctx.file.format || "",
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

export function basenameFromPath(filepath: string): string {
  return String(filepath).split(/[\\/]/).pop() || filepath;
}

export function splitFilename(filename: string): { basename: string; ext: string } {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return { basename: filename, ext: "" };
  }

  return {
    basename: filename.slice(0, lastDotIndex),
    ext: filename.slice(lastDotIndex + 1),
  };
}

function renderFilenameFormat(template: string, values: Record<string, string>): string {
  return String(template || "{filename}").replace(/\{([a-z_]+)\}/gi, (_, key: string) => {
    const value = values[key];
    return value == null ? "" : value;
  });
}

function hasExtension(filename: string): boolean {
  return Boolean(splitFilename(filename).ext);
}

function sanitizeFilename(filename: string): string {
  return String(filename)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
}

function sanitizeFilenamePart(value: string): string {
  return sanitizeFilename(value).replace(/\./g, " ");
}
