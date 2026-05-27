# Changelog

## [1.0.0]
- Upgrade the plugin workspace to `youwee-sdk` 2.1.0.
- Move the runtime entrypoint from JavaScript to TypeScript.
- Refactor the plugin source into focused modules for configuration, Google Drive API calls, file access, filename formatting, MIME detection, and error handling.
- Update the manifest compatibility range for the SDK 2.x runtime and Youwee app 0.15+.
- Remove direct Deno write permission from the local runtime check.
- Route payload file reads through the Youwee app-managed filesystem bridge boundary. Binary uploads require a Youwee runtime that exposes a binary file read bridge such as `ctx.youwee.fs.readBytes` or `ctx.youwee.fs.readBase64`.
- Add TypeScript type checking via `tsconfig.json` and `bun run typecheck`.
- Add an English setup guide for Google Drive OAuth configuration.

## [0.1.0]
- Initial scaffold
