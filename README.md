## Downloads
| Type | Download |
| --- | --- |
| Plugin file | [Download](https://github.com/vanloctech/youwee-plugin-gg-drive-upload/releases/latest/download/notification-webhooks.ywp) |
| Checksum | [SHA256](https://github.com/vanloctech/youwee-plugin-gg-drive-upload/releases/latest/download/notification-webhooks.ywp.sha256) |

# Google Drive Upload

This plugin automatically uploads a completed download file to a configured Google Drive folder.

The plugin runs on the `download.completed` trigger and requires the following configuration values:

| Config key | Required | Description |
| --- | --- | --- |
| `client_id` | Yes | OAuth 2.0 Client ID from Google Cloud Console |
| `client_secret` | Yes | OAuth 2.0 Client Secret paired with the Client ID |
| `refresh_token` | Yes | Token used by the plugin to request fresh access tokens |
| `folder_id` | Yes | Destination Google Drive folder ID |
| `filename_format` | No | Template for the uploaded file name |

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing project.
3. Go to **APIs & Services** -> **Library**.
4. Search for **Google Drive API**.
5. Click **Enable**.

## 2. Configure the OAuth consent screen

1. Go to **APIs & Services** -> **OAuth consent screen**.
2. Choose the app type:
   - **External** for a personal Gmail account.
   - **Internal** for an internal Google Workspace app.
3. Fill in the required fields, such as app name, user support email, and developer contact email.
4. Add this scope:

```text
https://www.googleapis.com/auth/drive.file
```

The `drive.file` scope allows the plugin to create and manage files uploaded by the plugin. If you need to upload to a Shared Drive or run into folder permission issues, you can use the broader scope:

```text
https://www.googleapis.com/auth/drive
```

Only use `drive` when needed because it grants broader Drive access.

5. If the app is in **Testing**, add your Google account under **Test users**.
6. For a long-lived `refresh_token`, publish the app as **In production** after setup. Apps left in testing can produce refresh tokens that expire sooner.

## 3. Get `client_id` and `client_secret`

1. Go to **APIs & Services** -> **Credentials**.
2. Click **Create credentials** -> **OAuth client ID**.
3. Set **Application type** to **Desktop app**.
4. Use a recognizable name, such as `Youwee Google Drive Upload`.
5. Click **Create**.
6. Copy these values:
   - **Client ID** -> plugin field `client_id`
   - **Client secret** -> plugin field `client_secret`

Example format:

```text
client_id: 1234567890-abc123.apps.googleusercontent.com
client_secret: GOCSPX-xxxxxxxxxxxxxxxx
```

## 4. Get `refresh_token`

The easiest way to get a refresh token is with Google OAuth 2.0 Playground.

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Click the settings icon in the top-right corner.
3. Enable **Use your own OAuth credentials**.
4. Enter:
   - **OAuth Client ID**: the `client_id` you created.
   - **OAuth Client secret**: the `client_secret` you created.
5. In the left panel, enter this scope:

```text
https://www.googleapis.com/auth/drive.file
```

If you configured the broader `drive` scope on the OAuth consent screen, enter:

```text
https://www.googleapis.com/auth/drive
```

6. Click **Authorize APIs**.
7. Sign in with the Google account that should upload files to the destination Drive folder.
8. Accept the permission screen.
9. After OAuth Playground redirects back, click **Exchange authorization code for tokens**.
10. Copy **Refresh token** -> plugin field `refresh_token`.

Example format:

```text
refresh_token: 1//0gabc123...
```

Notes:

- `refresh_token` is sensitive. Do not commit it to git or share it publicly.
- If you change the OAuth client, change scopes, revoke app access, or the token expires, generate a new `refresh_token`.
- If you get `invalid_grant`, generate a new `refresh_token` and check whether the OAuth consent app has been published **In production**.

## 5. Get `folder_id`

1. Open Google Drive.
2. Open the folder where the plugin should upload files.
3. Check the browser URL. It usually looks like this:

```text
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
```

4. Copy the value after `/folders/`:

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz
```

5. Enter that value in plugin field `folder_id`.

The Google account used to create the `refresh_token` must have permission to create files in this folder.

## 6. Configure `filename_format`

`filename_format` is optional. If left empty, the plugin uses the original file name:

```text
{filename}
```

Supported placeholders:

| Placeholder | Value |
| --- | --- |
| `{filename}` | Original file name, including extension |
| `{basename}` | Original file name without extension |
| `{ext}` | File extension |
| `{title}` | Media title, if available in the payload |
| `{source}` | Download source, such as `youtube` |
| `{quality}` | Download quality, such as `1080p` |
| `{format}` | Download format, such as `mp4` |
| `{date}` | Upload date in `YYYY-MM-DD` format |
| `{timestamp}` | Unix timestamp in milliseconds |

Example:

```text
{title} [{quality}]
```

If the original file is `video.mp4`, the title is `Sample video`, and the quality is `1080p`, the plugin uploads the file as:

```text
Sample video [1080p].mp4
```

The plugin automatically removes invalid filename characters such as `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, and `|`.

## 7. Enter the plugin configuration

In the plugin configuration screen, enter:

```text
client_id       = OAuth Client ID
client_secret   = OAuth Client Secret
refresh_token   = Refresh token from OAuth Playground
folder_id       = Destination Google Drive folder ID
filename_format = {filename}
```

After saving the configuration, every completed download will make the plugin:

1. Use `refresh_token` to request a Google access token.
2. Read the completed file from the `download.completed` payload.
3. Upload the file to the Drive folder configured by `folder_id`.
4. Return metadata including Google Drive file ID, uploaded file name, view link, and uploaded size.

## Troubleshooting

### `invalid_grant`

The refresh token is no longer valid.

Fix:

1. Generate a new `refresh_token` with OAuth Playground.
2. Make sure you are signed in with the correct Google account.
3. If the OAuth consent screen is still in **Testing**, publish it as **In production** for a more stable token.

### `insufficientFilePermissions`

The Google account does not have permission to upload into the destination folder, or the OAuth scope is too narrow.

Fix:

1. Check that the account used to create `refresh_token` has **Editor** access to the destination Drive folder.
2. Verify `folder_id`.
3. If you use a Shared Drive or a special folder, try generating the token with `https://www.googleapis.com/auth/drive`.

### `File not found`

The destination Drive folder does not exist or the Google account cannot access it.

Fix:

1. Open the Drive folder URL with the same account used to create `refresh_token`.
2. Copy `folder_id` again from the URL.
3. Make sure the folder has not been deleted or moved to an inaccessible location.

### Upload fails for large files or slow networks

The plugin has `timeoutSec` set to `300`, which means each run can take up to 5 minutes.

Fix:

1. Check the network connection.
2. Test with a smaller file to confirm the configuration works.
3. If large uploads are common, increase the plugin manifest timeout if the runtime should allow longer uploads.

## Security

- Do not share `client_secret` or `refresh_token`.
- Use a dedicated Google Cloud project for this plugin when possible.
- Use the narrowest scope that works, preferably `drive.file`.
- If you suspect a token was exposed, revoke the app access from Google Account -> Security -> Third-party access, then generate a new token.
