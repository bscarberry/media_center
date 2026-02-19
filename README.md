# Media Hub

A personal media aggregation desktop app built with Electron, React, TypeScript, and Vite. Brings together Spotify, YouTube, and Jellyfin into a single unified interface with integrated weather and news dashboards.

## Features

- **Spotify Integration** -- Web Playback SDK with OAuth2 PKCE authentication, streaming, queue management
- **YouTube Integration** -- Dual playback modes (iframe embed or yt-dlp audio extraction), YouTube Music search, OAuth for personal playlists
- **Jellyfin Integration** -- Connect to your self-hosted Jellyfin server for music streaming, offline caching, transcoding control
- **Unified Playback** -- Strategy-pattern media router with crossfade support, unified queue, and source-agnostic transport controls
- **Library & Search** -- Browse and search across all connected sources simultaneously with a unified search interface
- **Weather Dashboard** -- Current conditions, hourly chart, 7-day forecast, and severe weather alerts via OpenWeatherMap
- **News Dashboard** -- Category-filtered headlines, article reader, bookmarks, and infinite scroll via NewsAPI
- **Widget Framework** -- Resizable, draggable dashboard widgets using react-grid-layout with persistent layout
- **System Tray** -- Background playback controls (play/pause, next, previous) from the system tray
- **Cross-Platform** -- Builds for macOS (dmg), Windows (nsis/portable), and Linux (AppImage/deb)

## Prerequisites

- **Node.js** >= 18 (tested with v22)
- **npm** >= 9
- **Git**

You will also need API keys for any services you want to use (see [API Setup](#api-setup) below).

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd media_center
```

### 2. Install dependencies

```bash
npm install
```

> **Windows note:** The `.npmrc` file in the repo root automatically sets `YOUTUBE_DL_SKIP_PYTHON_CHECK=1` so that `youtube-dl-exec` installs without requiring Python. Python (and [yt-dlp](https://github.com/yt-dlp/yt-dlp)) are only needed at runtime if you use the YouTube `extract` playback mode.

### 3. Create your environment file

Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in the values. See [API Setup](#api-setup) for instructions on obtaining each key.

> **Packaged app note:** If you are running a built executable (e.g. from `out\win-arm64-unpacked\`) rather than `npm run dev`, place the `.env` file in the **same folder as the executable**. For example:
> ```
> out\win-arm64-unpacked\.env        ← place it here, next to Media Hub.exe
> out\win-arm64-unpacked\Media Hub.exe
> ```
> The app searches the executable's directory first when running as a packaged build.

### 4. Run in development mode

```bash
npm run dev
```

This starts both the Vite dev server (port 5173) and Electron concurrently. The app window will open once Vite is ready.

### 5. Build for production

```bash
# Build all three targets (renderer, main, preload)
npm run build

# Package into a distributable for your platform
npm run package         # auto-detect platform
npm run package:mac     # macOS .dmg / .zip
npm run package:win     # Windows .nsis / portable .exe
npm run package:linux   # Linux .AppImage / .deb
```

Packaged output is written to the `out/` directory.

## API Setup

The app connects to multiple external services. Each one requires its own credentials. You only need to set up the services you plan to use -- the app works with any combination.

All keys go into your `.env` file at the project root. **Never commit this file** (it is already in `.gitignore`).

---

### Spotify

Spotify is used for music streaming via the Web Playback SDK. Authentication uses OAuth2 with PKCE (no client secret needed).

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:
   - **App name**: anything (e.g. "Media Hub")
   - **Redirect URI**: `http://127.0.0.1:8888/callback` (use the IP address, not `localhost` — Spotify enforces this distinction)
   - **APIs used**: check **Web Playback SDK** and **Web API**
4. Click **Create**
5. On the app's overview page, copy the **Client ID**

**Required Spotify Premium** -- The Web Playback SDK requires a Spotify Premium subscription.

Add to `.env`:

```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | Your Spotify app's Client ID |
| `SPOTIFY_REDIRECT_URI` | No | OAuth callback URL (default: `http://127.0.0.1:8888/callback`) — must match exactly what is set in the Spotify Developer Dashboard |

---

### YouTube

YouTube is used for video/music playback and search via the YouTube Data API v3.

#### API Key (required)

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services > Library**
4. Search for **YouTube Data API v3** and click **Enable**
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > API Key**
7. Copy the key

Add to `.env`:

```
YOUTUBE_API_KEY=your_api_key_here
```

#### OAuth Credentials (optional -- for personal library access)

If you want to access your liked videos, playlists, and subscriptions:

1. In the same Google Cloud project, go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Select **Application type: Desktop app**
4. Copy the **Client ID** and **Client Secret**

Add to `.env`:

```
YOUTUBE_OAUTH_CLIENT_ID=your_oauth_client_id
YOUTUBE_OAUTH_CLIENT_SECRET=your_oauth_client_secret
YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:8889/callback
```

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `YOUTUBE_PLAYBACK_MODE` | No | `iframe` (default) or `extract` (uses yt-dlp) |
| `YOUTUBE_OAUTH_CLIENT_ID` | No | Google OAuth Client ID for personal data |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | No | Google OAuth Client Secret |
| `YOUTUBE_OAUTH_REDIRECT_URI` | No | OAuth callback (default: `http://localhost:8889/callback`) |

> **Note on `extract` playback mode**: This mode uses yt-dlp to extract direct audio streams. You must have [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available on your PATH.

---

### Jellyfin

Jellyfin integration lets you stream music from your self-hosted Jellyfin server.

1. Make sure your [Jellyfin](https://jellyfin.org) server is running and accessible from the machine running Media Hub
2. You can authenticate with either:
   - **Username + Password**: your regular Jellyfin login
   - **API Key**: generated from Jellyfin's admin dashboard under **Dashboard > API Keys**

Add to `.env`:

```
JELLYFIN_SERVER_URL=http://your-server-ip:8096

# Option A: Username/password
JELLYFIN_USERNAME=your_username
JELLYFIN_PASSWORD=your_password

# Option B: API key (alternative to username/password)
JELLYFIN_API_KEY=your_jellyfin_api_key
```

| Variable | Required | Description |
|----------|----------|-------------|
| `JELLYFIN_SERVER_URL` | Yes | Full URL of your Jellyfin server (include port) |
| `JELLYFIN_USERNAME` | No* | Jellyfin username (*required if not using API key) |
| `JELLYFIN_PASSWORD` | No* | Jellyfin password (*required if not using API key) |
| `JELLYFIN_API_KEY` | No* | Jellyfin API key (*alternative to username/password) |
| `JELLYFIN_TRANSCODE_QUALITY` | No | `original` (default), `high`, `medium`, or `low` |
| `JELLYFIN_ENABLE_TRANSCODING` | No | `true` or `false` (default: `false`) |
| `JELLYFIN_CACHE_DIRECTORY` | No | Custom path for offline cache (default: `<userData>/jellyfin-cache`) |
| `JELLYFIN_MAX_CACHE_SIZE` | No | Max cache in bytes (default: `5368709120` = 5 GB) |

---

### OpenWeatherMap (Weather Dashboard)

The weather widget uses the OpenWeatherMap One Call API 3.0.

1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Navigate to **API Keys** in your account
3. Subscribe to the **One Call API 3.0** (free tier includes 1,000 calls/day)
4. Copy your API key

Add to `.env`:

```
WEATHER_API_KEY=your_weather_api_key_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `WEATHER_API_KEY` | Yes | OpenWeatherMap API key |
| `WEATHER_DEFAULT_LAT` | No | Default latitude (if empty, uses browser geolocation) |
| `WEATHER_DEFAULT_LON` | No | Default longitude |
| `WEATHER_UNIT` | No | `fahrenheit` (default) or `celsius` |

---

### NewsAPI (News Dashboard)

The news widget uses NewsAPI for headlines and article search.

1. Sign up at [NewsAPI](https://newsapi.org)
2. Copy your API key from the account page

Free tier: 100 requests/day, headlines only.

Add to `.env`:

```
NEWS_API_KEY=your_news_api_key_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEWS_API_KEY` | Yes | NewsAPI key |
| `NEWS_COUNTRY` | No | Country code for headlines (default: `us`) |

---

## Project Structure

```
media_center/
├── src/
│   ├── main/                  # Electron main process
│   │   └── index.ts           #   Window creation, tray, IPC handlers
│   ├── preload/               # Electron preload (context bridge)
│   │   └── index.ts           #   Secure API exposed to renderer
│   └── renderer/              # React frontend (Vite-bundled)
│       ├── App.tsx            #   Root component, layout, routing
│       ├── main.tsx           #   React entry point
│       ├── components/
│       │   ├── dashboard/     #   Weather, news, widget framework
│       │   ├── library/       #   Browsing, search, content grids
│       │   └── player/        #   Playback bar, queue, volume, now playing
│       ├── services/
│       │   ├── spotify/       #   Spotify Web Playback SDK, auth, API
│       │   ├── youtube/       #   YouTube player, search, Music service
│       │   ├── jellyfin/      #   Jellyfin client, player, cache
│       │   ├── player/        #   Unified media router, strategy pattern
│       │   ├── search/        #   Cross-source search aggregation
│       │   ├── weather/       #   OpenWeatherMap service
│       │   └── news/          #   NewsAPI service
│       ├── stores/            #   Zustand state management
│       ├── hooks/             #   Custom React hooks
│       ├── types/             #   TypeScript type definitions
│       ├── utils/             #   Utility functions
│       └── styles/            #   Global CSS, Tailwind base
├── public/                    #   Static assets, app icons
├── index.html                 #   HTML entry point
├── package.json
├── vite.config.ts             #   Vite bundler config
├── tailwind.config.js         #   Tailwind CSS theme
├── tsconfig.json              #   TypeScript config (renderer)
├── tsconfig.main.json         #   TypeScript config (main process)
├── tsconfig.preload.json      #   TypeScript config (preload)
├── electron-builder.json      #   Packaging config
├── .env.example               #   Environment variable template
└── .gitignore
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite + Electron in development mode |
| `npm run dev:vite` | Start only the Vite dev server |
| `npm run build` | Build renderer (Vite), main (tsc), and preload (tsc) |
| `npm run package` | Build and package for current platform |
| `npm run package:mac` | Build and package for macOS |
| `npm run package:win` | Build and package for Windows |
| `npm run package:linux` | Build and package for Linux |
| `npm run type-check` | Type-check the renderer code |
| `npm run type-check:main` | Type-check the main process code |
| `npm run type-check:preload` | Type-check the preload code |
| `npm run type-check:all` | Type-check all three targets |
| `npm run lint` | Run ESLint on all source files |
| `npm run clean` | Remove `dist/` and `out/` directories |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | Electron 28 |
| Frontend | React 18, TypeScript 5 |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 3 |
| UI primitives | Radix UI |
| Icons | Lucide React |
| State management | Zustand 5 |
| Server state | TanStack React Query 5 |
| Routing | React Router 7 (HashRouter) |
| Animations | Framer Motion 12 |
| Charts | Recharts 3 |
| Virtualization | react-window 2 |
| Layout | react-grid-layout 2 |
| Audio | Howler.js, Spotify Web Playback SDK |
| Video | react-player |
| HTTP | Axios |
| Dates | date-fns 4 |
| Persistence | electron-store |
| Packaging | electron-builder |

## Troubleshooting

### `npm install` fails with "youtube-dl-exec needs Python"

The `youtube-dl-exec` package runs a Python check during installation. The `.npmrc` file in this repo skips that check automatically. If you still see this error, set the environment variable manually before installing:

```bash
# Windows (PowerShell)
$env:YOUTUBE_DL_SKIP_PYTHON_CHECK=1; npm install

# Windows (Command Prompt)
set YOUTUBE_DL_SKIP_PYTHON_CHECK=1 && npm install

# macOS / Linux
YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm install
```

Python is **not required** unless you use the YouTube `extract` playback mode (set `YOUTUBE_PLAYBACK_MODE=extract` in `.env`). The default `iframe` mode works without Python.

### EPERM errors on Windows during `npm install`

Windows may show `EPERM` cleanup warnings during installation. These are typically harmless -- the packages still install correctly. If installation fails entirely, try running your terminal as Administrator or deleting `node_modules` and retrying:

```bash
rd /s /q node_modules
npm install
```

## License

MIT
