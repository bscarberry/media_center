# Spotify Developer Dashboard Setup

Step-by-step guide to configure your Spotify app for Brandon's Media Hub.

## 1. Create a Spotify Application

1. Go to <https://developer.spotify.com/dashboard>
2. Log in with your Spotify Premium account
3. Click **Create App**
4. Fill in:
   - **App name:** Brandon's Media Hub
   - **App description:** Personal media center with Spotify playback
   - **Website:** (leave blank or use `http://localhost:8888`)
   - **Redirect URIs:** `http://localhost:8888/callback`
   - Check **Web Playback SDK** under "Which API/SDKs are you planning to use?"
5. Accept the Developer Terms of Service
6. Click **Save**

## 2. Copy Your Client ID

1. On the app's dashboard page, find **Client ID** (a 32-character hex string)
2. Copy it — you will NOT need a Client Secret (PKCE doesn't require one)
3. Add it to your `.env` file:

```
SPOTIFY_CLIENT_ID=your_32_char_client_id_here
```

## 3. Configure Redirect URIs

Under **Settings → Edit Settings → Redirect URIs**, ensure this exact URI is listed:

```
http://localhost:8888/callback
```

- For development, localhost is fine — Spotify allows it without HTTPS
- You can add multiple URIs if needed (e.g. different ports)
- The URI must match **exactly** what the app sends (including trailing slash or lack thereof)

## 4. Required Scopes

The app requests these scopes during authorization (handled automatically):

| Scope | Purpose |
|---|---|
| `streaming` | Web Playback SDK — play music in the app |
| `user-read-email` | Read user profile email |
| `user-read-private` | Read user subscription details |
| `user-read-playback-state` | Read currently playing track |
| `user-modify-playback-state` | Control playback (play, pause, skip) |
| `user-library-read` | Access "Liked Songs" and saved albums |
| `user-library-modify` | Save/remove tracks from library |
| `playlist-read-private` | Read user's private playlists |
| `playlist-read-collaborative` | Read collaborative playlists |
| `playlist-modify-public` | Create/edit public playlists |
| `playlist-modify-private` | Create/edit private playlists |

## 5. Environment Setup

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Client ID:
   ```
   SPOTIFY_CLIENT_ID=abc123def456...
   SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
   ```

3. The redirect URI defaults to `http://localhost:8888/callback` if omitted.

## 6. Verify Premium

The Web Playback SDK **requires Spotify Premium**. If your Premium subscription
lapses, the SDK will emit an `account_error` event with a clear message. Browse
and search features (via the REST API) will continue to work on a free account.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "INVALID_CLIENT" on login | Double-check that `SPOTIFY_CLIENT_ID` matches the Dashboard |
| "INVALID_REDIRECT_URI" | Ensure the redirect URI in your `.env` is listed **exactly** in Dashboard settings |
| Port 8888 already in use | Kill the other process or change `SPOTIFY_REDIRECT_URI` (and update Dashboard) |
| "Premium required" error | Verify your account at <https://www.spotify.com/account> |
| Token refresh fails | Try logging out and back in (`auth.logout()` then `auth.login()`) |
