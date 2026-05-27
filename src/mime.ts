import { splitFilename } from "./filename.ts";

const MIME_TYPES: Record<string, string> = {
  flac: "audio/flac",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  m4a: "audio/mp4",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  srt: "application/x-subrip",
  vtt: "text/vtt",
  wav: "audio/wav",
  webm: "video/webm",
  zip: "application/zip",
};

export function inferMimeType(filename: string): string {
  const ext = splitFilename(filename).ext.toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
