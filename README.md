# ⚔️ Red vs Blue - Live Real-Time Multiplayer Battle System

A real-time multiplayer scoring system featuring a **Web Dashboard** with live scoreboard animations and an **Android Mobile Application** with a split-screen controller (Red top half, Blue bottom half). Multiple mobile devices can connect simultaneously and tap to increase scores in real time.

---

## 🌟 Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │            Node.js + Socket.IO Server         │
                      │               (Port: 3000)                    │
                      └──────────────┬─────────────────┬──────────────┘
                                     │                 │
               WebSocket / Socket.io │                 │ WebSocket / Socket.io
                                     ▼                 ▼
             ┌───────────────────────────────┐   ┌──────────────────────────────┐
             │       Web Live Dashboard      │   │   Android Mobile App(s)      │
             │   - Room Creation (Code & QR) │   │   - Join with Room Code      │
             │   - Real-time Red vs Blue     │   │   - Split-screen (Red/Blue)  │
             │   - Tug-of-war battle meter   │   │   - Haptic vibration tap     │
             │   - Live taps-per-sec & log   │   │   - Live score pill          │
             └───────────────────────────────┘   └──────────────────────────────┘
```

---

## 📁 Project Directory Structure

```
qer/
├── server/                     # Node.js + Express + Socket.IO Server & Web Dashboard
│   ├── package.json
│   ├── server.js               # Room manager & Socket.IO real-time engine
│   └── public/
│       ├── index.html          # Web Dashboard UI
│       ├── style.css           # Glowing cyber-arena dark theme
│       ├── app.js              # Live updates, Web Audio sound synthesis, QR generation
│       └── controller.html     # Instant companion mobile web controller
│
├── android-app/                # Complete Native Android Studio Project
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── gradle.properties
│   ├── gradlew.bat
│   └── app/
│       ├── build.gradle.kts    # Configured with Socket.IO client & OkHttp
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── java/com/example/redvsblue/
│           │   ├── MainActivity.kt      # Join screen (Server IP, Room Code, Name)
│           │   ├── GameActivity.kt      # Split-screen (Red/Blue) controller
│           │   └── SocketManager.kt     # Real-time Socket.IO client manager
│           └── res/
│               ├── layout/
│               │   ├── activity_main.xml
│               │   └── activity_game.xml
│               └── values/
│                   ├── colors.xml
│                   ├── strings.xml
│                   └── themes.xml
│
└── README.md
```

---

## 🚀 Getting Started

### 1. Start the Server & Web Dashboard

Open PowerShell or terminal in the `server` directory:

```bash
cd server
npm install
npm start
```

The server will display your local IP addresses, for example:
```
🚀 Red vs Blue Live Arena Server is running on port 3000
   - Local Web Dashboard: http://localhost:3000
   - Network Access (Mobile/Wi-Fi): http://10.190.168.33:3000
```

1. Open your browser on your computer and navigate to: **`http://localhost:3000`**
2. Click **CREATE ROOM** (or enter a custom room code like `BATTLE`).
3. You will see:
   - The large **Room Code**
   - Active player counter
   - Dual scoreboards (RED vs BLUE)
   - Dynamic **Tug-of-War** dominance bar
   - Taps/second indicator
   - Live activity stream

---

### 2. Run the Android Mobile Application

The `android-app` folder is a standard Android project:

1. Launch **Android Studio**.
2. Select **Open** and choose the `c:\Users\Pankaj\Downloads\qer\android-app` folder.
3. Let Gradle sync dependencies (`io.socket:socket.io-client:2.1.1` and AndroidX components).
4. Connect an Android device via USB (with USB Debugging enabled) or start an Android Emulator.
5. In the app's Join Screen:
   - **Server IP / Address**: Enter your computer's local Wi-Fi IP and port (e.g. `10.190.168.33:3000`). *(Note: If using Android Emulator, use `10.0.2.2:3000`)*.
   - **Room Code**: Enter the room code shown on the Web Dashboard (e.g. `BATTLE` or the 6-character code).
   - **Your Name**: e.g. `Mobile Player 1`.
6. Tap **JOIN ROOM**.

---

### 3. Playing & Tapping

Once joined:
- The phone screen is divided in half:
  - **Top Half (RED)**: Tap to increment the Red team score.
  - **Bottom Half (BLUE)**: Tap to increment the Blue team score.
- Includes tactile **haptic vibration feedback** on every tap.
- Floating center pill shows the live room score and room code.
- **Multiple mobile apps** can connect to the exact same room at the same time. All taps update the Web Dashboard instantly in real time!

---

### 📱 Instant Mobile Web Controller (Alternative / Quick Test)

You can also test directly on any phone without installing an APK right away:
- On the Web Dashboard, click **📱 QR for Mobile**.
- Scan the QR code with your phone camera or visit:
  `http://<YOUR-IP>:3000/controller.html?room=<ROOM-CODE>`
- It provides the identical split-screen experience right in your phone's mobile browser.
