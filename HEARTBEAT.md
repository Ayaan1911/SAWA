# HEARTBEAT

## Loop contract
1. Read `memory-vault/goals.md`, supporting vault files, and recent logs.
2. Detect goal gaps and compute drift velocity.
3. Run the Claude reasoning core.
4. Format a user-facing intervention message.
5. Deliver via WhatsApp or Telegram fallback.
6. Write the decision back to `memory-vault/decisions/`.
7. Generate restart cards or reviews when thresholds require them.

## Triggering
- Default cadence is `HEARTBEAT_INTERVAL_HOURS`.
- Manual simulation is `npm run heartbeat:simulate`.
