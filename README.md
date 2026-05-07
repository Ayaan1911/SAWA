# SAWA Agent

SAWA is a TypeScript autonomous productivity agent centered on a markdown memory vault, a heartbeat loop, and intervention messaging.

## What is in this repo
- Root TypeScript backend for the decision engine, heartbeat, integrations, and Express dashboard
- `memory-vault/` for goals, logs, decisions, restart cards, and reviews
- `dashboard/` static dashboard served by the backend
- `csawa-agentlanding/` React landing page package

## Windows setup
1. Install Node.js 20+.
2. From `D:\Projects\sawa-agent`, run `npm install`.
3. Copy `.env.example` to `.env` and fill in the credentials you want to enable.
4. Run `npx tsc --noEmit` to verify the backend.
5. Run `npm run build` for backend plus landing page build output.
6. Run `node dist/index.js` to start the API and dashboard on `http://localhost:3000`.

## Core commands
- `npx tsc --noEmit`
- `npm run build`
- `npm run heartbeat:simulate`

## Manual setup still required
- Groq API key and model for live reasoning calls
- GitHub token plus watched owner/repo
- Google service-account JSON with Calendar read access
- WhatsApp Cloud API credentials or Telegram bot token/chat id

## Heartbeat loop
The implemented loop reads the vault, detects gaps, calculates drift, runs the Claude reasoning core, formats a delivery message, writes a decision artifact, and logs the cycle outcome.
