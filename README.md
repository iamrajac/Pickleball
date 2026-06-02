# 🏓 Pickleball Tournament Manager

A real-time, full-featured pickleball tournament management web application built for friend groups and local clubs. Manage round-robin tournaments, track live scores, run IPL-style playoffs, and build career statistics — all synced in real time across every device in the room.

**Live App:** [pickleball-eosin.vercel.app](https://pickleball-eosin.vercel.app)  
**Repository:** [github.com/iamrajac/Pickleball](https://github.com/iamrajac/Pickleball)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Tournament Flow](#tournament-flow)
- [Scoring Rules](#scoring-rules)
- [Playoff Formats](#playoff-formats)
- [Career Stats](#career-stats)
- [Multi-Device & Access Control](#multi-device--access-control)
- [Deployment](#deployment)

---

## Overview

This app was built to replace paper scoresheets for regular pickleball sessions. It supports any number of players (4–20), generates fair round-robin schedules, enforces official pickleball scoring rules, and syncs every score update live to all connected phones via Firebase Realtime Database — no refresh required.

---

## Features

### 🗓 Tournament Management
- **Round-robin scheduling** with smart rotation — unique partners and opponents prioritised before repeats
- **Any player count** from 4 to 20, including odd numbers (5, 6, 7, 9…)
- **Bye rotation** for odd counts — players sit out in fair rotation, never twice in a row
- **Custom round count** — choose how many rounds to play

### 📡 Real-Time Sync
- Every score update syncs instantly to all connected devices via Firebase
- **6-letter tournament code** — share to let anyone join as spectator
- **Online presence counter** — see how many people are watching live
- **Offline detection** — banner appears when connection drops, data syncs automatically on reconnect

### 🔒 Access Control
- **Creator identity** persisted in localStorage — rejoin as creator on same device after refresh
- **Scorer PIN system** — creator generates a 4-digit PIN; anyone who enters it gets full scoring access
- Spectators see read-only live view; scoring is locked behind creator or PIN

### 📊 Points Table
Columns: `# · Player · P · W · L · PTS · +/- · FOR · AGN · ELO · FORM`

- **ELO ratings** updated dynamically after every match
- **FORM** — last 5 results as coloured W/L tiles
- **Tap any row** to expand full match history with partner, opponents, score, and duration
- **Horizontal scroll** on mobile — all columns always visible
- **Copy for WhatsApp** — formatted standings text in one tap
- **Share as image** — downloadable standings card

### 🏆 Playoffs
Adaptive bracket format auto-selected based on player count:

| Players | Format |
|---------|--------|
| 4 | Grand Final only (1st+4th vs 2nd+3rd) |
| 5–7 | Semi Final + Grand Final |
| 8–11 | Full IPL: Q1 → Eliminator → Q2 → Final |
| 12–15 | Top 8: QF1 + QF2 → SF1 + SF2 → Final |
| 16–20 | Top 8 IPL: Q1 + Q2 + Eliminator → SF → Final |

All brackets use **competitive seeding** — 1st+4th vs 2nd+3rd, 5th+8th vs 6th+7th — ensuring balanced teams. Quick Final option available to skip straight to a single deciding match.

### ✅ Official Scoring Rules
- First to 11 points, win by 2
- Score validation enforced on input — `11-10` rejected, `12-10` accepted
- Extended games supported: if 10-10, play continues until 2-point lead is achieved
- Save button disabled until score is valid per official rules

### ⏱ Match Timer
- Per-match timer with start/pause
- Survives screen-off and tab switching — uses `Date.now()` timestamps, not frame counting
- Duration saved alongside each match result

### 📈 Tournament Awards
Shown in TABLE and PLAYOFFS tabs after at least 2 matches are played:
- ⚡ **MVP** — most wins in the tournament
- 🎯 **Best Win Rate** — highest win % (min 2 matches)
- 💥 **Top Scorer** — most points scored
- 🤝 **Best Duo** — partnership with highest win rate (min 2 matches together)

### 📊 Career Stats (All-Time)
Aggregated across all saved tournaments on the device:
- **Hall of Fame** — Most Titles, Best Win Rate, Longest Streak, Top Scorer
- **All-Time Records** — highest scoring match, biggest winning margin
- **Player leaderboard** — ranked by wins with full career stats
- **Player profiles** — tap any player for detailed profile: stats, streaks, form history
- **Head-to-Head** — visual win/loss bar between any two players
- **Partnerships tab** — all duo combinations ranked by win rate

### 🎉 Live Reactions
- Single 🏓 button fixed at bottom-right corner
- Tap to expand emoji picker (auto-closes after 5 seconds)
- Reactions float up on every connected device's screen in real time via Firebase

### 🌙 Dark / Light Mode
- Toggle available in topbar and home screen
- **Dark mode** — arena aesthetic with lime green accents
- **Light mode** — white cards, navy topbar, orange accents — completely independent palette
- Preference saved to localStorage across sessions

### 📤 Sharing
- **QR code** — scan to join tournament instantly
- **WhatsApp share** — pre-filled message with tournament code and join link
- **Standings image** — downloadable card with full player rankings
- **Auto-join from URL** — WhatsApp link opens app and joins tournament automatically via `?join=CODE`

### 🔊 Sound & Animation
- 3-note score chime (Web Audio API, no external files)
- Match card flashes lime on score save
- Multi-wave confetti burst when champion is crowned

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite |
| Database | Firebase Realtime Database (asia-southeast1) |
| Fonts | Bebas Neue, DM Sans (Google Fonts) |
| Icons | Lucide React |
| Libraries | `qrcode.react`, `html2canvas`, `canvas-confetti` |
| Hosting | Vercel (auto-deploy from GitHub) |

---

## Project Structure

```
pickleball-app/
├── index.html                      # Entry point, PWA meta tags, icon links
├── public/
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   ├── icon-16/32/192/512.png
│   └── manifest.json               # PWA manifest for home screen install
└── src/
    ├── App.jsx                     # Root component — all tournament state & logic
    ├── firebase.js                 # Firebase initialisation
    ├── index.css                   # Global styles, CSS variables, dark/light themes
    ├── main.jsx                    # React entry point
    ├── components/
    │   ├── AvatarPickerModal.jsx   # Player avatar/colour picker
    │   ├── MatchCard.jsx           # Match card with score input, timer, H2H
    │   ├── MatchTicker.jsx         # Live score ticker
    │   ├── PlayerAvatar.jsx        # Player avatar display component
    │   ├── PlayoffCard.jsx         # Playoff match card with score buffer
    │   ├── Reactions.jsx           # Live emoji reactions via Firebase
    │   ├── ScorerModal.jsx         # Scorer PIN generation and entry modal
    │   ├── ShareModal.jsx          # QR code + WhatsApp share modal
    │   ├── StandingsShare.jsx      # Generate and share standings as image
    │   ├── StandingsTable.jsx      # Full points table with ELO, form, history
    │   ├── Toast.jsx               # Toast notification provider
    │   └── TournamentAwards.jsx    # MVP, best duo, top scorer award cards
    ├── screens/
    │   ├── CareerScreen.jsx        # All-time career stats and player profiles
    │   ├── HistoryScreen.jsx       # Past tournament history browser
    │   └── SetupScreen.jsx         # Tournament setup and join screen
    └── utils/
        ├── audio.js               # Web Audio API sound effects
        ├── careerStats.js         # Career statistics computation engine
        ├── elo.js                 # ELO rating calculator
        ├── history.js             # localStorage persistence helpers + H2H matrix
        ├── pickleballRules.js     # Score validation (first to 11, win by 2)
        ├── schedule.js            # Schedule generator, standings, playoff init
        ├── theme.js               # Theme colour constants
        └── useTimer.js            # Match timer hook (survives screen off)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Realtime Database enabled

### Installation

```bash
git clone https://github.com/iamrajac/Pickleball.git
cd Pickleball
npm install
```

### Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** and set region to `asia-southeast1` (or your preferred region)
3. Set database rules to allow read/write during development:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
4. Copy your config into `src/firebase.js`:
```js
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.region.firebasedatabase.app",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## Tournament Flow

```
1. Creator opens app
   → Enters player names (4–20) and round count
   → Taps START TOURNAMENT

2. A 6-letter code is generated
   → Share via WhatsApp or QR code

3. Spectators open the link
   → Auto-joined as read-only live viewers

4. Creator (or scorer with PIN) enters scores as matches finish
   → Standings and ELO update live on all devices

5. When all group matches are done
   → Start Full Playoffs (adaptive bracket) or Quick Final

6. Playoffs proceed round by round
   → Champion declared → confetti 🎉
   → Tournament saved to history
   → Career stats updated
```

---

## Scoring Rules

Official pickleball scoring is enforced on all inputs:

| Score | Valid | Reason |
|-------|-------|--------|
| 11–0 through 11–9 | ✅ | First to 11, lead of 2+ |
| 11–10 | ❌ | Not a 2-point lead |
| 12–10 | ✅ | Extended game, win by 2 |
| 13–11 | ✅ | Extended game, win by 2 |
| 10–8 | ❌ | Neither team has reached 11 |

The SAVE button is disabled and a warning is shown until the score satisfies the official rules.

---

## Playoff Formats

All brackets use competitive seeding to balance every team:

**IPL Format (8–11 players)**
```
Q1:    1st+4th vs 2nd+3rd    → Winner → Final  |  Loser → Q2
Elim:  5th+8th vs 6th+7th   → Winner → Q2     |  Loser OUT
Q2:    Loser Q1 vs Winner Elim → Winner → Final |  Loser OUT
Final: Winner Q1 vs Winner Q2
```

**Top 8 Format (12–15 players)**
```
QF1:   1st+4th  vs 2nd+3rd   →  SF1
QF2:   5th+8th  vs 6th+7th   →  SF1
SF2:   9th+12th vs 10th+11th →  Final
Final: Winner SF1 vs Winner SF2
```

---

## Career Stats

Career stats are computed from all tournaments saved in the device's localStorage. They accumulate across sessions automatically and are accessible from the home screen.

**Per Player:**
- Total matches, wins, losses, points scored/conceded
- Win rate, ELO, current and best win streaks
- Tournament appearances and titles won
- Head-to-head record against every other player

**Per Partnership:**
- Matches played together, wins, losses, win rate, point differential

---

## Multi-Device & Access Control

| Role | How to Obtain | Permissions |
|------|--------------|-------------|
| **Creator** | Started the tournament on this device | Full scoring + playoff control |
| **Scorer** | Entered the 4-digit PIN from creator | Full scoring access |
| **Spectator** | Joined with code only | Read-only live updates |

Creator identity is stored in localStorage (`pkl_mine_v1`). Access level is held in a `useRef` (`canEditRef`) that the Firebase listener never overwrites — ensuring creator and scorer access survive reconnections, re-renders, and page refreshes.

---

## Deployment

Connected to Vercel via GitHub. Every push to `main` triggers an automatic production redeploy.

```bash
# Standard deploy workflow
git add .
git commit -m "describe your change"
git push
# Vercel redeploys automatically in ~30 seconds
```

No environment variables are required — the Firebase config is included directly in `src/firebase.js`.

---

## License

MIT — free to use, modify, and distribute.

---

*Built for the SRM Pickleball crew 🏓*
