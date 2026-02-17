# YouTube Integration Setup

Step-by-step guide to configure YouTube and YouTube Music for Brandon's Media Hub.

## 1. Create a Google Cloud Project

1. Go to <https://console.cloud.google.com>
2. Click **Select a project** > **New Project**
3. Name it "Brandon's Media Hub" and click **Create**
4. Select the newly created project

## 2. Enable YouTube Data API v3

1. Go to **APIs & Services** > **Library**
2. Search for "YouTube Data API v3"
3. Click it, then click **Enable**

## 3. Create an API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the key and add it to your `.env`:
   ```
   YOUTUBE_API_KEY=AIza...your_key_here
   ```
4. (Recommended) Click **Restrict Key** and limit it to "YouTube Data API v3"

**Note:** The API key allows 10,000 quota units per day. Search costs 100 units;
video/playlist lookups cost 1 unit each.

## 4. (Optional) Set Up OAuth for Personal Data

To access liked videos and private playlists:

1. In **APIs & Services** > **Credentials**, click **Create Credentials** > **OAuth client ID**
2. If prompted, configure the OAuth consent screen:
   - User type: **External** (or Internal if using Workspace)
   - App name: "Brandon's Media Hub"
   - Scopes: add `youtube.readonly` and `youtube`
   - Test users: add your Google email
3. Application type: **Desktop app**
4. Name: "Media Hub Desktop"
5. Click **Create** and copy the Client ID and Client Secret
6. Add to `.env`:
   ```
   YOUTUBE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   YOUTUBE_OAUTH_CLIENT_SECRET=GOCSPX-...
   YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:8889/callback
   ```

**Note:** The redirect URI uses port **8889** (Spotify uses 8888).

## 5. Choose a Playback Mode

Set `YOUTUBE_PLAYBACK_MODE` in your `.env`:

### Option A: `iframe` (Default, Recommended)

```
YOUTUBE_PLAYBACK_MODE=iframe
```

- Uses the official YouTube IFrame Player API
- Fully compliant with YouTube Terms of Service
- Player element must exist in the DOM (can be visually hidden)
- YouTube branding must remain accessible per ToS

### Option B: `extract` (Personal Use Only)

```
YOUTUBE_PLAYBACK_MODE=extract
```

- Uses yt-dlp to extract direct audio stream URLs
- Requires `yt-dlp` binary (installed automatically via `youtube-dl-exec`)
- Full control over the player UI
- Stream URLs expire after ~6 hours (auto-refreshed)
- Falls back to iframe mode if extraction fails
- **For personal use only** — review YouTube's Terms of Service

## 6. YouTube Music Features

YouTube Music shares the same Google account. With YouTube Premium:
- Search music specifically (filtered by Music category)
- Access YouTube Music playlists
- Get personalized recommendations
- Browse artist "Topic" channels for official audio

No additional API setup is needed — YouTube Music content is accessible
through the standard YouTube Data API v3.

## 7. Quota Management

YouTube Data API v3 has a daily quota of **10,000 units**:

| Operation | Cost |
|---|---|
| `search.list` | 100 units |
| `videos.list` | 1 unit |
| `playlists.list` | 1 unit |
| `playlistItems.list` | 1 unit |

The app caches responses for 5 minutes to reduce redundant calls.
At 100 units per search, you get ~100 searches per day.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| "API key not valid" | Check that the key is correct and the YouTube Data API is enabled |
| "quotaExceeded" | Wait until tomorrow (quota resets at midnight Pacific) or request a quota increase |
| "Forbidden" on liked videos | Set up OAuth (Step 4) — liked videos require user authentication |
| yt-dlp extraction fails | Ensure yt-dlp binary is present; run `npx youtube-dl-exec --version` to check |
| Port 8889 in use | Change `YOUTUBE_OAUTH_REDIRECT_URI` and update Google Cloud Console |
| "Video owner does not allow embedded playback" | Switch to extract mode or skip the video |
