# 🏓 Pickleball Tournament Manager

A highly interactive, real-time, offline-capable progressive web application built with React and Vite, designed to manage round-robin pickleball tournaments with your friends. 

This app removes the hassle of manual scheduling, scorekeeping, and calculating standings. Simply input your players, and let the app handle the rest—from auto-generating fair matchups to rendering live playoff brackets.

---

## ✨ Key Features

### 🏆 Tournament Generation & Management
- **Smart Auto-Scheduling:** Enter 4 to 20 players and select the number of rounds. The app automatically generates a fair, round-robin format schedule with rotating partners and opponents.
- **Bye Management:** If you have an odd number of players or more players than available courts, the app automatically tracks and rotates "Byes" (sitting out) fairly across the roster.
- **Multiple Playoff Modes:** Once the group stage finishes, seamlessly transition into playoff brackets like **Top 4**, **IPL Playoff Format**, **Top 8**, or a quick **Grand Final**.

### ⚡ Real-time Collaboration & Offline First
- **Firebase Sync:** Tournaments are assigned a unique 6-character code. Share the code with friends to let them view live score updates and standings on their own devices.
- **Spectator vs. Scorer:** The creator is automatically the "Scorer". They can securely share a PIN to grant other trusted users score-entry permissions while keeping everyone else as view-only spectators.
- **Offline Resilience:** If you lose internet connection on the courts, the app stores your scores locally and automatically syncs them to Firebase the moment you regain connectivity.

### 📊 Deep Analytics & UI Polish
- **Dynamic Standings:** A real-time leaderboard tracking Wins, Losses, Points Difference (+/-), Points For, Points Against, and Recent Form (WWLW).
- **Head-to-Head (H2H) Insights:** Before a match begins, tap a Match Card to view the lifetime historical win/loss record between the competing players across all past tournaments.
- **Match Timers:** Built-in stopwatch timers on every match card to keep play on schedule.
- **Celebratory Animations:** Custom confetti bursts upon saving a score, and rising trophy + fireworks animations for the Grand Champion.

### 🎨 Custom Player Avatars
- **Deep Personalization:** During the setup phase, tap any player's initials to assign them a custom avatar.
- **Avatar Types:** Choose from a curated color palette, popular emojis, or upload a real photo from your device's gallery.
- **Auto-Compression:** Uploaded photos are instantly resized and compressed client-side (via Canvas API) to ensure blazing-fast network sync without bloating the database.

---

## 🛠 Tech Stack

- **Frontend Framework:** React 18
- **Build Tool:** Vite (Ultra-fast HMR)
- **Styling:** Custom CSS with CSS Variables for a dynamic, modern "glassmorphism" aesthetic.
- **Backend / Database:** Firebase Realtime Database
- **Icons:** Lucide React
- **Animations:** Canvas-confetti & CSS Keyframes

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pickleball-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase (Optional but Recommended)**
   The app expects a `src/firebase.js` file exporting your Firebase app and database instance. If you don't set this up, the app will still function completely locally!
   
4. **Run the development server**
   ```bash
   npm run dev
   ```
   
5. **Open in Browser**
   Navigate to `http://localhost:5173` to view the app.

---

## 📖 Usage Guide

1. **Setup Screen:** Open the app and set the total number of players. Type in their names.
2. **Customize Avatars:** Tap the colorful circle next to any player's name to give them an emoji or photo avatar.
3. **Generate:** Choose how many rounds you want to play, and tap "CREATE TOURNAMENT".
4. **Share:** You will be given a Tournament Code. Friends can go to the app and enter this code to watch live.
5. **Play:** Tap a Match Card to open it. Start the timer, play the game, enter the final score, and hit "SAVE". 
6. **Review:** Swipe over to the "Standings" tab at any time to see the live leaderboard, MVP, Best Duo, and Top Scorer awards.
7. **Playoffs:** Once all group-stage rounds are complete, hit "FULL PLAYOFFS" to generate the final elimination bracket and crown your champion!

---

## 📂 Project Structure Highlights

- `src/App.jsx`: The core orchestration component managing Firebase sync, tabs, and top-level state.
- `src/screens/`: Contains the major views (`SetupScreen`, `HistoryScreen`, `CareerScreen`).
- `src/components/`: Reusable, isolated UI components (`MatchCard`, `PlayoffCard`, `StandingsTable`, `PlayerAvatar`, `AvatarPickerModal`).
- `src/utils/`: Core logic modules.
  - `scheduler.js`: The algorithmic engine that generates fair round-robin pairings.
  - `history.js`: Manages LocalStorage H2H historical records and career stat aggregations.
  - `pickleballRules.js`: Score validation (win by 2, minimum score of 11, etc.).

---

*Built with ❤️ for the love of Pickleball.*
