# 📻 WalkieTalkie - Push-to-Talk Communication App

A real walkie-talkie experience on your phone. Push-to-talk, 100 channels, no crosstalk.

## Architecture

```
walkie-talkie/
├── server/     # Node.js signaling server (Socket.IO + WebRTC signaling)
├── mobile/     # React Native app (iOS + Android)
└── web/        # Frontend landing page (deployed to Render)
```

## Features

- **Push-to-Talk (PTT)**: Press and hold to transmit, release to listen
- **100 Channels**: Independent channels numbered 1-100
- **No Crosstalk**: Server-enforced floor control — only one person speaks at a time
- **Queue System**: If channel is busy, you're queued automatically
- **Low Latency**: WebRTC peer-to-peer audio (~50ms latency)
- **Multi-User**: Unlimited users per channel
- **30s Max Transmission**: Prevents channel hogging
- **Haptic Feedback**: Vibration on PTT press/grant

## Quick Start

### 1. Start the Server

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3001`

### 2. Run the Mobile App

```bash
cd mobile
npm install

# Android
npx react-native run-android

# iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

### 3. Run the Web Frontend

```bash
cd web
npm install
npm start
```

Web runs on `http://localhost:3000`

## Deployment to Render

### Option A: Blueprint (Recommended)

1. Push this repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your repo — Render will read `render.yaml` and deploy both services

### Option B: Manual

**Backend:**
1. New Web Service → connect repo → root dir: `server`
2. Build: `npm install` | Start: `npm start`
3. Plan: Free

**Frontend:**
1. New Web Service → connect repo → root dir: `web`
2. Build: `npm install` | Start: `npm start`
3. Plan: Free

### Update Server URL

After deploying the backend, update the server URL in:
- `mobile/src/services/SocketService.ts` — change the production URL

## Building Release APK/IPA

### Android APK

```bash
cd mobile/android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### iOS IPA

```bash
cd mobile/ios
xcodebuild -workspace WalkieTalkie.xcworkspace \
  -scheme WalkieTalkie \
  -configuration Release \
  -archivePath build/WalkieTalkie.xcarchive archive

xcodebuild -exportArchive \
  -archivePath build/WalkieTalkie.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/
```

Place built files in `web/public/downloads/` for the landing page download links.

## How PTT Works

1. User presses PTT button → `ptt-press` event sent to server
2. Server checks if channel has a current speaker
3. If channel is clear → grants floor, emits `ptt-granted` to all
4. Granted user's mic is unmuted, audio streams via WebRTC
5. User releases → `ptt-release` → server emits `ptt-released`
6. After 500ms cooldown, next queued user gets the floor

## Tech Stack

- **Server**: Node.js, Express, Socket.IO
- **Mobile**: React Native, react-native-webrtc, Socket.IO client
- **Web**: Express static server, vanilla HTML/CSS
- **Audio**: WebRTC (peer-to-peer, STUN via Google)
- **Signaling**: WebSocket (Socket.IO)
- **Deploy**: Render (free tier)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/channels` | List all channels with user counts |
| GET | `/api/channels/:id` | Get channel details and users |

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `set-username` | Client→Server | Set display name |
| `join-channel` | Client→Server | Join a channel (1-100) |
| `leave-channel` | Client→Server | Leave current channel |
| `ptt-press` | Client→Server | Request to transmit |
| `ptt-release` | Client→Server | Stop transmitting |
| `ptt-granted` | Server→Client | Floor granted to a user |
| `ptt-released` | Server→Client | Speaker released floor |
| `ptt-queued` | Server→Client | Added to speaker queue |
| `channel-joined` | Server→Client | Successfully joined channel |
| `user-joined` | Server→Client | Another user joined |
| `user-left` | Server→Client | Another user left |

## License

MIT
