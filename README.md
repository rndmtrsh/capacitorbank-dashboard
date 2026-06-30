# SCADA Capacitor Banks Dashboard

Modern SCADA-style web UI for monitoring three-phase capacitor banks with
real-time power factor and current telemetry. Built with React, TypeScript,
Vite, and Firebase Realtime Database.

## Overview

This dashboard provides a comprehensive monitoring solution for VAR adaptive
compensator systems in electrical power distribution. It displays real-time
telemetry from three-phase capacitor banks, including voltage, current,
active/reactive power, and capacitor step status for each phase (R, S, T).

## Features

### Real-time Monitoring

- **Live Phase Telemetry**: Continuous monitoring of voltage (0-600V), current (0-200A), and power factor for each of the three phases
- **Active & Reactive Power**: Real-time calculation and display of kW and kVAR values
- **Capacitor Bank Steps**: Visual indicator showing active steps (0-4) per phase with dot indicators
- **Load Balance Detection**: Automatic assessment of phase current imbalance (Balanced/Moderate/High)

### Data Visualization

- **Power Factor Trend Chart**: Real-time line chart showing average power factor with 0.8 threshold reference line
- **Phase Current Trend Chart**: Three-line chart displaying current trends for phases R, S, and T
- **Rolling History**: Maintains up to 90 data points for trend analysis
- **Delta Indicators**: Percentage change indicators for power factor and current trends

### User Interface

- **SCADA-inspired Design**: Dark green color scheme optimized for control-room readability
- **Glass-morphism Cards**: Semi-transparent panels with blur effects and subtle hover animations
- **Smooth Scrolling Navigation**: Vertical snap-scroll between dashboard sections
- **Bottom Navigation Bar**: Quick access to Overview, 3-Phase, Cos φ, and History sections
- **Responsive Layout**: Adapts to different screen sizes with max-width container

### System Information

- **Target Power Factor**: Configurable threshold (default 0.8)
- **System Capacity**: Displays total compensation capacity (10.8 MVAR)
- **Efficiency Metrics**: Real-time system efficiency calculation
- **Step Summary**: Total active steps across all phases (max 12)

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.6 | UI framework |
| TypeScript | ~6.0.2 | Type safety |
| Vite | 8.0.12 | Build tool and dev server |
| Firebase | 10.12.5 | Realtime Database backend |
| Chart.js | 4.5.1 | Data visualization |

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm or yarn package manager
- Firebase project with Realtime Database enabled

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open the local dev server (typically http://localhost:5173) shown in the terminal.

### Production Build

```bash
npm run build
npm run preview
```

## Environment Variables

This application uses Firebase configuration from environment variables prefixed with
`FARHAN_`. Vite is configured to expose these variables to the client. Create a
`.env` file in the project root:

```env
FARHAN_FIREBASE_API_KEY=your-api-key
FARHAN_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FARHAN_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FARHAN_FIREBASE_PROJECT_ID=your-project-id
FARHAN_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FARHAN_FIREBASE_MESSAGING_SENDER_ID=123456789
FARHAN_FIREBASE_APP_ID=1:123456789:web:abcdef
FARHAN_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `FARHAN_FIREBASE_API_KEY` | Firebase API key for authentication |
| `FARHAN_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FARHAN_FIREBASE_DATABASE_URL` | Realtime Database URL |
| `FARHAN_FIREBASE_PROJECT_ID` | Firebase project ID |
| `FARHAN_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `FARHAN_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `FARHAN_FIREBASE_APP_ID` | Firebase app ID |
| `FARHAN_FIREBASE_MEASUREMENT_ID` | Google Analytics measurement ID (optional) |

After updating the `.env` file, restart the dev server to apply changes.

## Firebase Data Structure

The application expects data in the following format from Firebase Realtime Database:

```json
{
  "R": {
    "tegangan": 220.5,
    "arus": 15.2,
    "pf": 0.85,
    "step": 2,
    "aktif": 3200,
    "reaktif": 1800
  },
  "S": {
    "tegangan": 219.8,
    "arus": 14.9,
    "pf": 0.83,
    "step": 2,
    "aktif": 3150,
    "reaktif": 1750
  },
  "T": {
    "tegangan": 221.1,
    "arus": 15.5,
    "pf": 0.86,
    "step": 2,
    "aktif": 3250,
    "reaktif": 1850
  }
}
```

### Field Descriptions

| Field | Indonesian | Description | Range |
|-------|------------|-------------|-------|
| `tegangan` | Voltage | Phase voltage | 0-600 V |
| `arus` | Current | Phase current | 0-200 A |
| `pf` | Power Factor | Power factor (cos φ) | 0-1 |
| `step` | Steps | Active capacitor steps | 0-4 |
| `aktif` | Active Power | Active power (kW) | - |
| `reaktif` | Reactive Power | Reactive power (kVAR) | - |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server with hot reload |
| `npm run build` | Type-check (tsc -b) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint for code quality checks |

## Project Structure

```
capacitorBanks/
├── src/
│   ├── App.tsx          # Main application component with all UI logic
│   ├── App.css          # SCADA-themed styles and animations
│   ├── main.tsx         # React entry point
│   ├── index.css        # Global styles
│   ├── assets/          # Static assets and images
│   └── inspiration.html # Design reference
├── public/              # Static files served as-is
├── vite.config.ts       # Vite configuration (env prefix setup)
├── tsconfig.json        # TypeScript configuration
├── tsconfig.app.json    # App-specific TypeScript config
├── tsconfig.node.json   # Node-specific TypeScript config
├── eslint.config.js     # ESLint configuration
└── package.json         # Dependencies and scripts
```

## Deployment Notes

- Ensure all `FARHAN_` environment variables are configured in your hosting platform
- The production build runs `tsc -b` (type checking) followed by `vite build`
- Firebase Realtime Database rules should allow read access to the data paths
- For Firebase hosting, add environment config in `firebase.json` or use `.env.production`

## Browser Support

- Modern browsers with ES6+ support
- Requires JavaScript enabled
- Optimized for Chrome, Firefox, Safari, and Edge
