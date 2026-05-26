# SCADA Capacitor Banks Dashboard

Modern SCADA-style web UI for monitoring three-phase capacitor banks with
real-time power factor and current telemetry. Built with React, TypeScript,
Vite, and Firebase Realtime Database.

## Features

- Live phase monitoring (voltage, current, active/reactive power)
- Capacitor bank step status and power factor compensation
- Power factor and current trend charts
- SCADA-inspired visual theme optimized for control-room readability

## Tech Stack

- React 19 + TypeScript 6
- Vite 8 (client build)
- Firebase Realtime Database
- Chart.js 4

## Getting Started

```bash
npm install
npm run dev
```

Open the local dev server shown in the terminal.

## Environment Variables

This app reads Firebase configuration from environment variables prefixed with
`FARHAN_` and exposes them to the client through Vite. Create a local `.env`
file (or set them in your hosting platform) using `.env.example` as a template.

Required keys:

- `FARHAN_FIREBASE_API_KEY`
- `FARHAN_FIREBASE_AUTH_DOMAIN`
- `FARHAN_FIREBASE_DATABASE_URL`
- `FARHAN_FIREBASE_PROJECT_ID`
- `FARHAN_FIREBASE_STORAGE_BUCKET`
- `FARHAN_FIREBASE_MESSAGING_SENDER_ID`
- `FARHAN_FIREBASE_APP_ID`
- `FARHAN_FIREBASE_MEASUREMENT_ID`

After updating the `.env` file, restart the dev server to apply changes.

## Scripts

```bash
npm run dev       # Start Vite dev server
npm run build     # Type-check and build for production
npm run preview   # Preview the production build
npm run lint      # Run ESLint
```

## Deployment Notes

- Ensure all `FARHAN_` env vars are configured in the hosting platform.
- The production build runs `tsc -b` and `vite build`.

## Project Structure

- `src/` UI components and styles
- `public/` static assets
- `vite.config.ts` Vite configuration (env prefix)
