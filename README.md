# BTL Dashboard (with Time Table & Daily Routine Tracker)

Modern, aesthetic personal habit, goals, and daily routine tracker built with Next.js, Tailwind CSS, Framer Motion, and Firebase.

## 🚀 Key Features

1. **Time Table / Routine Layout (NEW)**:
   - Schedule tasks by start time and end time (e.g. `05:00 - 06:30`).
   - Interactive goal-style checkbox to mark tasks as completed.
   - Dynamic real-time "Now" indicator for ongoing slots.
   - Smooth entrance, exit, and reorder animations via Framer Motion.
   - Quick Add bar with time selectors, task description, categories, and orange action button.
   - Category tagging (Routine, Trading, Health, Study, Work).
   - Filter by All, Pending, or Completed.
   - Dynamic progress bar showing daily completion percentage.
   - Synchronized per calendar date via localStorage.

2. **Life Big Goals & Life Rules**:
   - Long-term aspirations and foundational daily principles in rounded pastel cards.

3. **Calendar & Financial Tracking**:
   - Monthly calendar navigation.
   - Earned money & spent money input tracker with daily notes and mood selector.

4. **Daily Goals & Extry Goals**:
   - Checklists with priority indicators ('M' Medium, etc.) and repeat sync status.
   - Instant inline item addition.

5. **Analytics Summary & Streak Tracker**:
   - Daily, Extry, and Overall progress indicators.
   - Active day streak badge.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI & Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Backend / Database**: Firebase & Firestore

## 📦 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Structure

```
├── app/
│   ├── layout.jsx
│   ├── page.jsx
│   ├── globals.css
│   ├── dashboard/
│   └── login/
├── components/
│   ├── BTLDashboard.jsx
│   ├── TimeTable.jsx          # NEW Time Table Component
│   ├── BTLLoadingScreen.jsx
│   ├── AuthGuard.jsx
│   └── FriendCelebration.jsx
├── lib/
│   ├── btlStorage.js          # Time Table & Dashboard Storage
│   ├── firebase.js
│   └── AuthContext.jsx
└── README.md
```
