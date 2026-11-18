# 🚀 Deploying Ringside to Render (Public Internet Hosting)

This guide walks you through deploying your Boxing Match Scoring backend & web application to **Render.com** so it runs on the public internet over secure HTTPS and WSS (WebSockets).

---

## 1. Quick Deploy with Git

1. Initialize git in the root folder and push to your GitHub / GitLab account:
   ```bash
   git init
   git add .
   git commit -m "feat: ringside boxing scoring system"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```

2. Log in to [Render.com](https://dashboard.render.com).
3. Click **New +** &rarr; **Web Service**.
4. Connect your GitHub repository.
5. Set the following settings:
   - **Name**: `ringside-boxing` *(or your choice)*
   - **Region**: Closest to you (e.g., Singapore, Frankfurt, Oregon, Ohio)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. Click **Deploy Web Service**.

---

## 2. Using the Render URL on Web & Mobile

Once deployed, Render provides an HTTPS URL such as:
`https://ringside-boxing.onrender.com`

### Admin / Match Supervisor:
- Open `https://ringside-boxing.onrender.com` in your laptop browser from anywhere in the world.
- Create your match room.
- The dashboard automatically adapts and produces QR codes and join URLs using your Render domain.

### Mobile Ringside Judges:
- **Option 1 (No Installation)**: Judges can open:
  `https://ringside-boxing.onrender.com/judge.html?room=<ROOM_CODE>`
- **Option 2 (Native Android APK)**: 
  - Judges download the APK directly from:
    `https://ringside-boxing.onrender.com/download/boxing-judge.apk`
  - In the app's **Server Address** field, enter:
    `ringside-boxing.onrender.com` *(or `https://ringside-boxing.onrender.com`)*
  - Enter the **Room Code** and **Judge Seat** to connect!

---

## 3. Session & Room Isolation
- Multiple simultaneous bouts and different rings run completely isolated on the same server.
- Each bout code has its own countdown clock, judges list, strike registers, and 10-Point-Must scorecard table.
