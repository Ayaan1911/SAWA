# Project Context

## Architecture
User -> OpenClaw-compatible docs and skills -> SAWA decision engine -> Memory Vault.

## Decision Engine
- Memory Vault is the source of truth.
- Heartbeat daemon drives the loop.
- Gap detection and drift scoring precede reasoning.
- Groq (llama-3.3-70b-versatile) integration produces concise interventions.

## Tooling
- GitHub repo intelligence
- Google Calendar meeting intelligence
- arXiv research digest
- WhatsApp primary messaging with Telegram fallback
- Express dashboard for runtime visibility
