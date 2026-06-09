# 🏓 Pickleball Tournament Manager

A real-time, full-featured pickleball tournament management web app built for friend groups and local clubs. Create tournaments, track live scores, run playoffs, build career stats, and manage clubs — all synced instantly across every device.

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
- [Firebase Rules](#firebase-rules)
- [Deployment](#deployment)

---

## Overview

Built to replace paper scoresheets for regular pickleball sessions. Supports 4–20 players, generates fair round-robin schedules, enforces official scoring rules, and syncs every update live to all connected phones via Firebase — no refresh required. Players can create accounts, build career stats, join clubs, and follow tournaments as spectators.

---

## Features

### 👤 Player Identity & Accounts
- **Google Sign-In** — one-tap login, no password needed
- **Custom profile** — display name, bio, emoji/colour/photo avatar
- **Unique username** — claim your `@handle` for a public profile URL (`/player/username`)
- **Player search** — type 2+ characters when adding players to see registered users
- **Badges** — earned automatically: First Win, Champion, 5× Champ, 10 Matches, Sharpshooter, 5-Win Streak
- **Public player page** — career stats, badges, H2H record, tournament history — shareable link

### 🗓 Tournament Management
- **Round-robin scheduling** — smart rotation, unique partners and opponents prioritised before repeats
- **Any player count** from 4 to 20, including odd numbers
- **Bye rotation** for odd counts — fair sit-out rotation, never twice in a row
- **Custom round count** — choose how many rounds to play
- **Public & private tournaments** — public ones appear in discovery feed
- **Upcoming tournaments** — schedule in advance, scoring locks until start time
- **Delete tournament** — removes from Realtime DB, Firestore, localStorage, and public discovery

### 📡 Real-Time Sync
- Every score update syncs instantly to all connected devices via Firebase Realtime Database
- **6-letter tournament code** — share to let anyone join as spectator
- **Online presence counter** — see how many people are watching live
- **Offline detection** — banner appears when connection drops

### 🔒 Access Control
- **Creator** — full scoring and playoff control, persisted in localStorage
- **Scorer PIN** — creator generates a 4-digit PIN; anyone who enters it gets full scoring access
- **Spectators** — read-only live view, can claim their player slot to earn stats
- **Guest mode** — browse and spectate without an account

### 📊 Standings Table
Columns: `# · Player · P · W · L · PTS · +/- · FOR · AGN · FORM`

- **FORM** — last 5 results as coloured W/L tiles
- **Tap any row** — expands full match history with partner, opponents, score, and duration
- **Copy for WhatsApp** — formatted standings text in one tap
- **Share as image** — downloadable standings card

### 🏆 Playoffs
Adaptive bracket format auto-selected based on player count:

| Players | Format |
|---------|--------|
| 4 | Grand Final only |
| 5–7 | Semi Final + Grand Final |
| 8–11 | Full IPL: Q1 → Eliminator → Q2 → Final |
| 12–15 | Top 8: QF × 2 → SF × 2 → Final |
| 16–20 | Top 8 IPL extended |

- Visual bracket tree with WINNER/LOSER flow arrows
- Toggle between BRACKET and SCORES view
- Quick Final option to skip straight to a deciding match

### ✅ Official Scoring Rules
- First to 11 points, win by 2
- Score validation enforced — `11-10` rejected, `12-10` accepted
- Extended games supported up to any score with 2-point lead

### ⏱ Match Timer
- Per-match timer with start/pause
- Survives screen-off and tab switching using `Date.now()` timestamps
- Duration saved alongside each match result

### 📈 Tournament Awards
Shown after at least 2 matches are played:
- ⚡ **MVP** — most wins in the tournament
- 🎯 **Best Win Rate** — highest win % (min 2 matches)
- 💥 **Top Scorer** — most points scored
- 🤝 **Best Duo** — partnership with highest win rate

### 📊 Career Analytics
Aggregated across all tournaments the user has participated in:

**Player Stats:**
- Total matches, wins, losses, win rate, current and best streaks
- Tournament appearances and titles won
- Win rate trend chart per tournament

**Partner Analytics:**
- Best partner (✅) and worst partner (⚠️) by win rate
- Nemesis detection — who beats you most

**Performance by Round:**
- Win % breakdown per round number

**AI-Style Insight Cards:**
- Scrollable insight strip on Career and player profile pages
- Personalised: streak, nemesis, best partner, win rate trend, best round, titles

### 🏘 Clubs
- **Create or join a club** with a 6-character invite code
- **Club dashboard** — Members, Leaderboard, Matches, Season tabs
- **Club leaderboard** — tracks titles, wins, losses, and matches per member automatically (no claiming needed)
- **Member picker** in tournament setup — tap member chips instead of typing names when creating from a club
- **Auto tournament linking** — tournaments created from a club auto-appear in the Matches tab
- **Season system** — create seasons, standings update with points (1pt participate + 2pt win)
- **Admin controls** — delete club, remove members
- **Member controls** — leave club anytime

### 📣 Social & Communication
- **Announcements board** — organiser posts visible to all participants
- **In-tournament chat** — reactions and messaging feed
- **Live emoji reactions** — float up on every connected device in real time
- **TV Mode** — fullscreen scoreboard, auto-rotates matches for display screens
- **Shareable standings image** — downloadable card with full player rankings
- **QR code sharing** — scan to join instantly
- **WhatsApp share** — pre-filled message with tournament code and join link
- **Email invite** — invite players by email via EmailJS

### 📲 PWA (Installable App)
- Install to home screen on Android and iOS
- Offline caching via Workbox service worker
- Loading skeletons, score animations, haptic feedback
- 7-day install prompt dismiss

### 🌙 Dark / Light Mode
- Auto-detects OS preference, follows live changes
- Manual override saved across sessions
- Fully independent colour palettes for each mode

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite |
| Realtime DB | Firebase Realtime Database (asia-southeast1) |
| Persistent DB | Firebase Firestore |
| Auth | Firebase Auth (Google Sign-In) |
| Email | EmailJS |
| PWA | vite-plugin-pwa, Workbox |
| Fonts | Bebas Neue, Inter (Google Fonts) |
| Icons | Lucide React |
| Libraries | `qrcode.react`, `html2canvas`, `canvas-confetti` |
| Hosting | Vercel (auto-deploy from GitHub) |

---

## Project Structure

```
Pickleball/
├── index.html                        # Entry point, PWA meta, Apple tags
├── firebase.json                     # Firebase deployment config
├── .firebaserc                       # Firebase project alias
├── functions/
│   └── index.js                      # Cloud Functions (auto-start, notifications)
├── public/
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   ├── icon-16/32/192/512.png
│   ├── manifest.json                 # PWA manifest
│   └── firebase-messaging-sw.js     # FCM service worker
└── src/
    ├── App.jsx                       # Root component, routing, tournament state
    ├── firebase.js                   # Firebase initialisation
    ├── index.css                     # Global styles, CSS variables, themes
    ├── main.jsx                      # React entry point
    ├── components/
    │   ├── Announcements.jsx         # Tournament announcements board
    │   ├── AuthModal.jsx             # Google sign-in modal
    │   ├── AvatarPickerModal.jsx     # Emoji / colour / photo avatar picker
    │   ├── BottomNav.jsx             # 5-tab bottom navigation
    │   ├── BracketTree.jsx           # Visual playoff bracket diagram
    │   ├── ClaimBanner.jsx           # Banner to claim player slot for stats
    │   ├── InstallPrompt.jsx         # PWA install banner
    │   ├── MatchCard.jsx             # Match card with score input and timer
    │   ├── MatchTicker.jsx           # Live score ticker strip
    │   ├── Onboarding.jsx            # First-visit 3-step overlay
    │   ├── PlayerAvatar.jsx          # Avatar display (emoji / colour / image)
    │   ├── PlayerSearchInput.jsx     # Registered user search while adding players
    │   ├── PlayoffCard.jsx           # Playoff match card
    │   ├── Reactions.jsx             # Live floating emoji reactions
    │   ├── ScorerModal.jsx           # PIN generation and entry
    │   ├── ShareModal.jsx            # QR code + WhatsApp + email invite
    │   ├── Skeleton.jsx              # Shimmer loading skeletons
    │   ├── StandingsShare.jsx        # Generate standings image
    │   ├── StandingsTable.jsx        # Full points table with form and history
    │   ├── Toast.jsx                 # Toast notification provider
    │   ├── TournamentAwards.jsx      # MVP, best duo, top scorer cards
    │   ├── TournamentChat.jsx        # In-tournament chat feed
    │   └── TVMode.jsx                # Fullscreen TV scoreboard
    ├── screens/
    │   ├── AccountScreen.jsx         # Profile view and edit
    │   ├── CareerScreen.jsx          # Career stats, analytics, insight cards
    │   ├── ClubDashboardScreen.jsx   # Club detail — members, leaderboard, matches, seasons
    │   ├── ClubsScreen.jsx           # Clubs list, create, join
    │   ├── HistoryScreen.jsx         # Past tournaments browser
    │   ├── HubScreen.jsx             # Home — live, upcoming, recent tournaments
    │   ├── PlayerScreen.jsx          # Public player profile page
    │   ├── PublicTournamentScreen.jsx # Public tournament view (no login needed)
    │   └── SetupScreen.jsx           # Tournament setup and join
    ├── hooks/
    │   ├── useAuth.js                # Auth state, Google sign-in, guest mode
    │   ├── useClub.js                # Club CRUD, season management, Firestore sync
    │   └── useTournament.js          # Full tournament state, Firebase sync, scoring
    └── utils/
        ├── audio.js                  # Web Audio API sound effects
        ├── careerStats.js            # Career statistics computation
        ├── fcm.js                    # FCM token registration and notifications
        ├── globalProfiles.js         # Cross-tournament avatar/profile cache
        ├── history.js                # localStorage persistence + H2H matrix
        ├── nameMatcher.js            # Fuzzy name matching for player claiming
        ├── notifications.js          # Push notification helpers
        ├── pickleballRules.js        # Score validation (first to 11, win by 2)
        ├── playerProfile.js          # Firestore player profile CRUD, badges
        ├── players.js                # Player utilities and duplicate detection
        ├── schedule.js               # Schedule generator, standings, playoff init
        ├── theme.js                  # Theme colour constants
        └── useTimer.js               # Match timer hook
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Realtime Database, Firestore, and Authentication enabled

### Installation

```bash
git clone https://github.com/iamrajac/Pickleball.git
cd Pickleball
npm install
```

### Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database**, **Firestore**, and **Google Authentication**
3. Copy your config into `src/firebase.js`

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build for Production

```bash
npm run build
```

---

## Tournament Flow

```
1. Creator opens app → signs in with Google
   → Enters player names and round count
   → Optionally sets schedule time, theme, public/private
   → Taps START TOURNAMENT

2. A 6-letter code is generated
   → Share via WhatsApp, QR code, or email

3. Spectators open the link → auto-joined as read-only live viewers
   → Registered users can claim their player slot to earn career stats

4. Creator (or scorer with PIN) enters scores as matches finish
   → Standings update live on all devices

5. When all group matches are done
   → Start playoffs (adaptive bracket auto-selected) or Quick Final

6. Playoffs proceed round by round
   → Champion declared → confetti 🎉
   → Tournament saved to history and club (if club tournament)
   → Career stats and club leaderboard update automatically
```

---

## Scoring Rules

| Score | Valid | Reason |
|-------|-------|--------|
| 11–0 through 11–9 | ✅ | First to 11, lead of 2+ |
| 11–10 | ❌ | Not a 2-point lead |
| 12–10 | ✅ | Extended game, win by 2 |
| 13–11 | ✅ | Extended game, win by 2 |
| 10–8 | ❌ | Neither team has reached 11 |

---

## Playoff Formats

**IPL Format (8–11 players)**
```
Q1:    1st+4th vs 2nd+3rd    → Winner → Final  |  Loser → Q2
Elim:  5th+8th vs 6th+7th   → Winner → Q2     |  Loser OUT
Q2:    Loser Q1 vs Winner Elim → Winner → Final |  Loser OUT
Final: Winner Q1 vs Winner Q2
```

**Top 8 Format (12–15 players)**
```
QF1:  1st+4th  vs 2nd+3rd   → SF1
QF2:  5th+8th  vs 6th+7th   → SF1
SF2:  9th+12th vs 10th+11th → Final
Final: Winner SF1 vs Winner SF2
```

---

## Firebase Rules

**Realtime Database:**
```json
{
  "rules": {
    "tournaments": {
      "$code": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "presence": {
      ".read": true,
      ".write": true
    },
    "$other": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

---

## Deployment

Connected to Vercel via GitHub. Every push to `main` triggers an automatic production redeploy in ~30 seconds.

```bash
git add .
git commit -m "your change"
git push
```

---

*Built for the SRM Pickleball crew 🏓*
