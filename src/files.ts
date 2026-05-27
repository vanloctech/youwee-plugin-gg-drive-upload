import type { PluginContext, PluginFileSystemBridge } from "youwee-sdk";

type BinaryFileSystemBridge = PluginFileSystemBridge & {
  readBytes?: (path: string) => Promise<Uint8Array | number[] | string>;
  readBase64?: (path: string) => Promise<string>;
};

export async function readPayloadFileBytes(
  ctx: PluginContext,
  path: string,
): Promise<Uint8Array> {
  const fs = ctx.youwee.fs as BinaryFileSystemBridge;

  if (typeof fs.readBytes === "function") {
    return normalizeBytePayload(await fs.readBytes(path));
  }

  if (typeof fs.readBase64 === "function") {
    return decodeBase64(await fs.readBase64(path));
  }

  throw new Error(
    "The Youwee runtime does not expose a binary file reader. This plugin requires ctx.youwee.fs.readBytes or ctx.youwee.fs.readBase64 for app-managed payload reads.",
  );
}

function normalizeBytePayload(value: Uint8Array | number[] | string): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }

  return decodeBase64(value);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
