# Jellyfin Setup Guide

This guide walks you through configuring Brandon's Media Hub to connect to your Jellyfin server.

## Prerequisites

- A running Jellyfin server (v10.8+)
- A user account on that server **or** an API key
- Network access from the machine running this app to the Jellyfin server

## 1. Find Your Server URL

Your Jellyfin server URL is typically:

| Setup | URL |
|---|---|
| Local (default port) | `http://localhost:8096` |
| Local (custom port) | `http://localhost:<port>` |
| LAN | `http://<server-ip>:8096` |
| Reverse proxy / HTTPS | `https://jellyfin.yourdomain.com` |

Make sure the URL is reachable from the machine running Brandon's Media Hub.

## 2. Authentication

You can authenticate with **either** username/password or an API key.

### Option A: Username & Password (Recommended)

Use the same credentials you log in to Jellyfin with:

```env
JELLYFIN_USERNAME=brandon
JELLYFIN_PASSWORD=your_password
```

The app authenticates via `/Users/AuthenticateByName` and stores the session token locally (encrypted with electron-store).

### Option B: API Key

1. Open your Jellyfin dashboard: **Settings > Advanced > API Keys**
2. Click **+** to create a new key
3. Give it a name (e.g. "Brandon's Media Hub")
4. Copy the generated key

```env
JELLYFIN_API_KEY=your_api_key_here
```

API keys bypass user-level permissions and have full server access. Username/password auth is preferred for per-user library access and playback tracking.

## 3. Environment Variables

Copy `.env.example` to `.env` and fill in the Jellyfin section:

```env
# Required
JELLYFIN_SERVER_URL=http://localhost:8096

# Auth – pick one method
JELLYFIN_USERNAME=brandon
JELLYFIN_PASSWORD=your_password
# JELLYFIN_API_KEY=

# Optional – transcoding
JELLYFIN_TRANSCODE_QUALITY=original
JELLYFIN_ENABLE_TRANSCODING=false

# Optional – offline cache
JELLYFIN_CACHE_DIRECTORY=
JELLYFIN_MAX_CACHE_SIZE=5368709120
```

### Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `JELLYFIN_SERVER_URL` | Yes | — | Full URL of your Jellyfin server |
| `JELLYFIN_USERNAME` | No* | — | Jellyfin username |
| `JELLYFIN_PASSWORD` | No* | — | Jellyfin password |
| `JELLYFIN_API_KEY` | No* | — | Jellyfin API key |
| `JELLYFIN_TRANSCODE_QUALITY` | No | `original` | `original`, `high` (320k AAC), `medium` (192k MP3), `low` (128k MP3) |
| `JELLYFIN_ENABLE_TRANSCODING` | No | `false` | Enable server-side transcoding |
| `JELLYFIN_CACHE_DIRECTORY` | No | `<userData>/jellyfin-cache` | Local directory for offline cached tracks |
| `JELLYFIN_MAX_CACHE_SIZE` | No | `5368709120` (5 GB) | Maximum cache size in bytes |

\* You must provide either username + password **or** an API key.

## 4. Transcoding

By default the app streams audio in its original format (direct play). This gives the best quality with the lowest server load, but requires the Electron/Chromium runtime to support the codec.

If you encounter playback issues with certain formats (e.g. DSD, APE), enable transcoding:

```env
JELLYFIN_ENABLE_TRANSCODING=true
JELLYFIN_TRANSCODE_QUALITY=high
```

| Quality | Codec | Bitrate |
|---|---|---|
| `original` | Passthrough | Original |
| `high` | AAC | 320 kbps |
| `medium` | MP3 | 192 kbps |
| `low` | MP3 | 128 kbps |

## 5. Offline Cache

The app can download tracks for offline playback. Downloaded files are stored in the cache directory and indexed in an encrypted electron-store database.

- **Cache directory** defaults to `<userData>/jellyfin-cache` (Electron's per-user data path).
- **Max cache size** defaults to 5 GB. The oldest tracks are evicted automatically when the limit is reached (LRU policy).
- Use `JellyfinCache.clearCache()` or the UI to wipe all cached files.

## 6. Verify the Connection

After configuring your `.env` file, launch the app. The `useJellyfinPlayer` hook will auto-connect on mount if credentials are present. Check the console or the UI for:

- **Connected** — authenticated and ready to browse / play
- **Authentication error** — check your username/password or API key
- **Connection lost** — the server is unreachable; the app will attempt to reconnect automatically

## Troubleshooting

| Issue | Fix |
|---|---|
| "Authentication error" | Double-check username/password or API key. Ensure the user account isn't disabled. |
| "Connection to Jellyfin server lost" | Verify the server is running and the URL is reachable. Check firewall rules. |
| Playback fails on certain codecs | Enable transcoding (`JELLYFIN_ENABLE_TRANSCODING=true`). |
| Cache fills up quickly | Increase `JELLYFIN_MAX_CACHE_SIZE` or clear the cache. |
| CORS errors in dev mode | Make sure Jellyfin's CORS settings allow your app's origin, or run via Electron (no CORS). |
